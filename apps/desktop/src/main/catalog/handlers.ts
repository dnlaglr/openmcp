import { inputErrors, type CatalogInstall, type InstalledServer } from "@openmcp/contracts";
import { listServers, type Database } from "@openmcp/database";

import { fetchPopular, getRegistryServer, searchRegistry } from "./registry";
import type { Supervisor } from "../servers/supervisor";
import { saveServer } from "../servers/servers";
import { choosePlan } from "./launch";
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
  if (!plan) throw new Error("This server has no package OpenMCP can run.");

  const [invalid] = Object.values(inputErrors(plan.inputs, input.values));
  if (invalid) throw new Error(invalid);

  const { secrets, ...launch } = plan.build(input.values);
  return saveServer(db, {
    name: input.name,
    source: "registry",
    registryName: server.name,
    version: server.version,
    autostart: input.autostart,
    launch,
    secrets
  });
}

export function registerCatalogHandlers(db: Database, supervisor: Supervisor) {
  handle("catalog:popular", () => fetchPopular());
  handle("catalog:search", ({ query, cursor }) => searchRegistry(query, cursor));

  handle("catalog:install", async (input) => {
    const server = await installServer(db, input);
    emit("servers:changed");

    void supervisor.start(server.id);
    return server;
  });
}
