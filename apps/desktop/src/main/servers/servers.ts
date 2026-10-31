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
import {
  LaunchSpec,
  secretNames,
  type InstalledServer,
  type NewCustomServer,
  type ServerUpdate
} from "@openmcp/contracts";
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

// Every save passes through here, so a Catalog value that builds a broken URL is caught like a typed one.
function stored(launch: Launch, secrets: string[]): LaunchSpec {
  const spec = launch.type === "stdio" ? { ...launch, secretEnv: secrets } : { ...launch, secretHeaders: secrets };
  const parsed = LaunchSpec.safeParse(spec);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  return parsed.data;
}

function launchOf(fields: NewCustomServer | ServerUpdate): Launch {
  return fields.type === "stdio"
    ? { type: "stdio", command: fields.command, args: fields.args, env: fields.env }
    : { type: "http", url: fields.url, headers: fields.headers };
}

export type NewServer = Pick<NewInstalledServer, "name" | "source" | "registryName" | "version" | "autostart"> & {
  launch: Launch;
  secrets: Record<string, string>;
};

export function saveServer(db: Database, { launch, secrets, ...server }: NewServer): InstalledServer {
  checkName(db, server.name);
  const spec = stored(launch, Object.keys(secrets));

  const id = randomUUID();
  return withSecrets(id, secrets, () => addServer(db, { ...server, id, launch: spec }));
}

export function addCustomServer(db: Database, input: NewCustomServer): InstalledServer {
  return saveServer(db, {
    name: input.name,
    source: "custom",
    autostart: input.autostart,
    launch: launchOf(input),
    secrets: input.secrets
  });
}

export function editServer(db: Database, input: ServerUpdate & { version?: string }): InstalledServer {
  const { id, name, autostart, version, secrets, keepSecrets } = input;
  const current = getServer(db, id);
  if (!current) throw new Error("That server no longer exists.");
  if (current.launch.type !== input.type) throw new Error("A server's type can't change.");
  checkName(db, name, id);

  const storedNames = secretNames(current.launch);

  // Read every moved value before writing any, so swapping two names works.
  const writes = { ...secrets };
  for (const [next, from] of Object.entries(keepSecrets)) {
    if (!storedNames.includes(from)) throw new Error(`There's no stored secret named ${from}.`);
    if (next === from) continue;

    const value = getSecret(secretKey(id, from));
    if (value === null) throw new Error(`The secret ${from} is missing from your keychain. Enter its value again.`);
    writes[next] = value;
  }

  const names = [...Object.keys(secrets), ...Object.keys(keepSecrets)];
  const launch = stored(launchOf(input), names);
  const saved = withSecrets(id, writes, () => {
    const updated = updateServer(db, id, { name, autostart, ...(version === undefined ? {} : { version }), launch });
    if (!updated) throw new Error("That server no longer exists.");
    return updated;
  });

  deleteSecrets(
    id,
    storedNames.filter((stale) => !names.includes(stale))
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

  const { launch } = server;
  const secrets = Object.fromEntries(secretNames(launch).map((name) => [name, readSecret(id, name)]));

  return launch.type === "stdio"
    ? { type: "stdio", command: launch.command, args: launch.args, env: { ...launch.env, ...secrets } }
    : { type: "http", url: launch.url, headers: { ...launch.headers, ...secrets } };
}

export function deleteServer(db: Database, id: string) {
  const server = getServer(db, id);
  if (!server) return;

  removeServer(db, id);
  deleteSecrets(id, secretNames(server.launch));
}
