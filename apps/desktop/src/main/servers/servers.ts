import { randomUUID } from "node:crypto";

import { addServer, getServer, listServers, removeServer, type Database } from "@openmcp/database";
import type { InstalledServer, NewCustomServer } from "@openmcp/contracts";
import { deleteSecret, getSecret, setSecret } from "@openmcp/secrets";

import type { Launch } from "./connection";

const secretKey = (serverId: string, name: string) => `server:${serverId}:${name}`;

function deleteSecrets(serverId: string, names: string[]) {
  for (const name of names) deleteSecret(secretKey(serverId, name));
}

export function addCustomServer(db: Database, input: NewCustomServer): InstalledServer {
  if (listServers(db).some((server) => server.name === input.name)) {
    throw new Error(`A server named "${input.name}" already exists.`);
  }

  const id = randomUUID();
  const stored: string[] = [];

  try {
    for (const [name, value] of Object.entries(input.secrets)) {
      setSecret(secretKey(id, name), value);
      stored.push(name);
    }

    return addServer(db, {
      id,
      name: input.name,
      source: "custom",
      autostart: input.autostart,
      launch: { command: input.command, args: input.args, env: input.env, secretEnv: Object.keys(input.secrets) }
    });
  } catch (error) {
    deleteSecrets(id, stored);
    throw error;
  }
}

export function launchFor(db: Database, id: string): Launch {
  const server = getServer(db, id);
  if (!server) throw new Error("That server no longer exists.");

  const env = { ...server.launch.env };
  for (const name of server.launch.secretEnv) {
    const value = getSecret(secretKey(id, name));
    if (value === null) {
      throw new Error(
        `The secret ${name} is missing from your keychain. Remove and re-add the server to set it again.`
      );
    }

    env[name] = value;
  }

  return { command: server.launch.command, args: server.launch.args, env };
}

export function deleteServer(db: Database, id: string) {
  const server = getServer(db, id);
  if (!server) return;

  removeServer(db, id);
  deleteSecrets(id, server.launch.secretEnv);
}
