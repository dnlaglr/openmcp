import { randomUUID } from "node:crypto";

import {
  addServer,
  getServer,
  listServers,
  removeServer,
  updateServer,
  type Database,
  type NewInstalledServer
} from "@openmcp/database";
import type { InstalledServer, NewCustomServer, ServerUpdate } from "@openmcp/contracts";
import { deleteSecret, getSecret, setSecret } from "@openmcp/secrets";

import type { Launch } from "./connection";

const secretKey = (serverId: string, name: string) => `server:${serverId}:${name}`;

function deleteSecrets(serverId: string, names: string[]) {
  for (const name of names) deleteSecret(secretKey(serverId, name));
}

function withSecrets<T>(serverId: string, secrets: Record<string, string>, save: () => T): T {
  const previous = new Map<string, string | null>();

  try {
    for (const [name, value] of Object.entries(secrets)) {
      const old = getSecret(secretKey(serverId, name));
      setSecret(secretKey(serverId, name), value);
      previous.set(name, old);
    }

    return save();
  } catch (error) {
    for (const [name, value] of previous) {
      if (value === null) deleteSecret(secretKey(serverId, name));
      else setSecret(secretKey(serverId, name), value);
    }

    throw error;
  }
}

function checkName(db: Database, name: string, id?: string) {
  if (listServers(db).some((server) => server.name === name && server.id !== id)) {
    throw new Error(`A server named "${name}" already exists.`);
  }
}

export type NewServer = Pick<NewInstalledServer, "name" | "source" | "registryName" | "version" | "autostart"> & {
  launch: Launch;
  secrets: Record<string, string>;
};

export function saveServer(db: Database, { launch, secrets, ...server }: NewServer): InstalledServer {
  checkName(db, server.name);

  const id = randomUUID();
  return withSecrets(id, secrets, () =>
    addServer(db, { ...server, id, launch: { ...launch, secretEnv: Object.keys(secrets) } })
  );
}

export function addCustomServer(db: Database, input: NewCustomServer): InstalledServer {
  return saveServer(db, {
    name: input.name,
    source: "custom",
    autostart: input.autostart,
    launch: { command: input.command, args: input.args, env: input.env },
    secrets: input.secrets
  });
}

export function editServer(
  db: Database,
  { id, command, args, env, secrets, keepSecrets, ...server }: ServerUpdate & { version?: string }
): InstalledServer {
  const current = getServer(db, id);
  if (!current) throw new Error("That server no longer exists.");
  checkName(db, server.name, id);

  // Read every moved value before writing any, so swapping two names works.
  const writes = { ...secrets };
  for (const [name, from] of Object.entries(keepSecrets)) {
    if (!current.launch.secretEnv.includes(from)) throw new Error(`There's no stored secret named ${from}.`);
    if (name === from) continue;

    const value = getSecret(secretKey(id, from));
    if (value === null) throw new Error(`The secret ${from} is missing from your keychain. Enter its value again.`);
    writes[name] = value;
  }

  const secretEnv = [...Object.keys(secrets), ...Object.keys(keepSecrets)];
  const saved = withSecrets(id, writes, () => {
    const updated = updateServer(db, id, { ...server, launch: { command, args, env, secretEnv } });
    if (!updated) throw new Error("That server no longer exists.");
    return updated;
  });

  deleteSecrets(
    id,
    current.launch.secretEnv.filter((name) => !secretEnv.includes(name))
  );
  return saved;
}

export function readSecret(serverId: string, name: string) {
  const value = getSecret(secretKey(serverId, name));
  if (value === null) {
    throw new Error(`The secret ${name} is missing from your keychain. Edit the server to set it again.`);
  }

  return value;
}

export function launchFor(db: Database, id: string): Launch {
  const server = getServer(db, id);
  if (!server) throw new Error("That server no longer exists.");

  const env = { ...server.launch.env };
  for (const name of server.launch.secretEnv) env[name] = readSecret(id, name);

  return { command: server.launch.command, args: server.launch.args, env };
}

export function deleteServer(db: Database, id: string) {
  const server = getServer(db, id);
  if (!server) return;

  removeServer(db, id);
  deleteSecrets(id, server.launch.secretEnv);
}
