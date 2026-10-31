import {
  inputErrors,
  isStoredSecret,
  secretNames,
  type AvailableUpdate,
  type CatalogInstall,
  type CatalogUpdate,
  type InstalledServer
} from "@openmcp/contracts";
import { getServer, listServers, type Database, type InstalledServerRow } from "@openmcp/database";

import { fetchPopular, getRegistryServer, searchRegistry } from "./registry";
import { editServer, readSecret, saveServer } from "../servers/servers";
import { choosePlan, swapPackage, toCatalogEntry } from "./launch";
import type { Supervisor } from "../servers/supervisor";
import { emit, handle } from "../ipc";

// The renderer only sends values; the launch is always rebuilt from the registry's own server.json.
export async function installServer(db: Database, input: CatalogInstall): Promise<InstalledServer> {
  const entry = await getRegistryServer(input.registryName, input.version);
  if (!entry) throw new Error("This version is no longer in the registry. Search again to get the latest one.");

  const { server } = entry;
  if (listServers(db).some((installed) => installed.registryName === server.name)) {
    throw new Error(`${server.title ?? server.name} is already installed.`);
  }

  const plan = choosePlan(server);
  if (!plan) throw new Error("This server has no package or remote OpenMCP can run.");

  const [invalid] = Object.values(inputErrors(plan.inputs, input.values));
  if (invalid) throw new Error(invalid);

  const launch = plan.build(input.values);
  return saveServer(db, {
    name: input.name,
    source: "registry",
    registryName: server.name,
    version: server.version,
    autostart: input.autostart,
    launch,
    secrets: launch.secrets
  });
}

async function availableUpdate(server: InstalledServerRow): Promise<AvailableUpdate | null> {
  if (!server.registryName || !server.version) return null;

  const latest = await getRegistryServer(server.registryName, "latest");
  if (!latest || latest.server.version === server.version) return null;

  // An installed server keeps its kind, so a new version that adds a package still shows the remote's inputs.
  const { type } = server.launch;
  const plan = choosePlan(latest.server, type);
  const entry = toCatalogEntry(latest, type);
  if (!plan || !entry) return null;

  const installed = await getRegistryServer(server.registryName, server.version);
  const from = installed && choosePlan(installed.server, type);
  return { serverId: server.id, from: server.version, entry, inputsChanged: !swapPackage(server.launch, from, plan) };
}

// A lookup that fails leaves that server out; Popular already reports a registry that can't be reached.
export async function findUpdates(db: Database): Promise<AvailableUpdate[]> {
  const results = await Promise.allSettled(listServers(db).map(availableUpdate));
  return results.flatMap((result) => (result.status === "fulfilled" && result.value ? [result.value] : []));
}

export async function applyUpdate(db: Database, { id, version, values }: CatalogUpdate): Promise<InstalledServer> {
  const server = getServer(db, id);
  if (!server?.registryName || !server.version) throw new Error("That server isn't from the Catalog.");

  const { type } = server.launch;
  const next = await getRegistryServer(server.registryName, version);
  const plan = next && choosePlan(next.server, type);
  if (!next || !plan) {
    throw new Error("This version is no longer available. Open the Catalog again to get the latest one.");
  }

  const saved = { id, name: server.name, autostart: server.autostart, version: next.server.version };

  if (!values) {
    const installed = await getRegistryServer(server.registryName, server.version);
    const launch = swapPackage(server.launch, installed && choosePlan(installed.server, type), plan);
    if (!launch) throw new Error("This update changes the server's settings. Open it again to review them.");

    const keepSecrets = Object.fromEntries(secretNames(launch).map((name) => [name, name]));
    return editServer(db, { ...saved, ...launch, secrets: {}, keepSecrets });
  }

  const names = secretNames(server.launch);
  const filled = { ...values };
  for (const input of plan.inputs) {
    if (isStoredSecret(input, names) && !values[input.id]?.trim()) {
      filled[input.id] = readSecret(id, input.label);
    }
  }

  const [invalid] = Object.values(inputErrors(plan.inputs, filled));
  if (invalid) throw new Error(invalid);

  return editServer(db, { ...saved, ...plan.build(filled), keepSecrets: {} });
}

export function registerCatalogHandlers(db: Database, supervisor: Supervisor) {
  handle("catalog:popular", () => fetchPopular());
  handle("catalog:search", ({ query, cursor }) => searchRegistry(query, cursor));
  handle("catalog:updates", () => findUpdates(db));

  handle("catalog:install", async (input) => {
    const server = await installServer(db, input);
    emit("servers:changed");

    void supervisor.start(server.id);
    return server;
  });

  handle("catalog:update", async (input) => {
    const server = await applyUpdate(db, input);
    emit("servers:changed");

    void supervisor.restartIfActive(server.id);
    return server;
  });
}
