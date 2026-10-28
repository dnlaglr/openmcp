import { randomUUID } from "node:crypto";

import { addServer, listServers, removeServer, type Database } from "@openmcp/database";
import type { InstalledServer, NewCustomServer } from "@openmcp/contracts";
import { deleteSecret, setSecret } from "@openmcp/secrets";

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


export function deleteServer(db: Database, id: string) {
  const server = listServers(db).find((candidate) => candidate.id === id);
  if (!server) return;

  removeServer(db, id);
  deleteSecrets(id, server.launch.secretEnv);
}
