import { existsSync, readdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { app, shell } from "electron";
import { homedir } from "node:os";
import { join } from "node:path";

import { lastCallByClient, type Database } from "@openmcp/database";
import type { ClientId, ClientState } from "@openmcp/contracts";

import { apply, countBackups, inspect, pick, type ClientContext } from "./files";
import { CLIENTS, entryName, lastSeen, type ClientDefinition } from "./clients";
import type { Gateway } from "../gateway/gateway";
import { emit, handle } from "../ipc";

const clientOf = (id: ClientId) => CLIENTS.find((client) => client.id === id)!;

function storePackages() {
  const local = process.env.LOCALAPPDATA;
  if (process.platform !== "win32" || !local) return [];

  try {
    return readdirSync(join(local, "Packages"));
  } catch {
    return [];
  }
}

function contextFor(gateway: Gateway): ClientContext {
  return {
    env: {
      platform: process.platform,
      home: homedir(),
      appData: app.getPath("appData"),
      localAppData: process.env.LOCALAPPDATA,
      packages: storePackages(),
      claudeConfigDir: process.env.CLAUDE_CONFIG_DIR,
      codexHome: process.env.CODEX_HOME
    },
    name: entryName(app.isPackaged),
    bridge: {
      command: process.env.APPIMAGE ?? process.execPath,
      script: join(app.getAppPath(), "dist/main/bridge.js")
    },
    connection: gateway.connection(),
    backups: join(app.getPath("userData"), "client-backups")
  };
}

async function open(path: string) {
  const failure = await shell.openPath(path);
  if (failure) throw new Error(failure);
}

export function registerClientHandlers(gateway: Gateway, db: Database) {
  const written = new Set<ClientId>();
  let queue: Promise<unknown> = Promise.resolve();

  function serially<T>(task: () => Promise<T>) {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  }

  async function stateOf(client: ClientDefinition, context: ClientContext, calls = lastCallByClient(db)) {
    return {
      ...(await inspect(client, context)),
      hint: written.has(client.id) ? client.hint : null,
      lastSeenAt: lastSeen(client, calls),
      backups: await countBackups(join(context.backups, client.id))
    } satisfies ClientState;
  }

  async function write(client: ClientDefinition, context: ClientContext, connect: boolean) {
    await apply(client, context, connect);
    written.add(client.id);
  }

  const change = (id: ClientId, connect: boolean) =>
    serially(async () => {
      const client = clientOf(id);
      const context = contextFor(gateway);

      await write(client, context, connect);
      return stateOf(client, context);
    });

  handle("clients:list", () => {
    const context = contextFor(gateway);
    const calls = lastCallByClient(db);
    return Promise.all(CLIENTS.map((client) => stateOf(client, context, calls)));
  });
  handle("clients:connect", ({ id }) => change(id, true));
  handle("clients:disconnect", ({ id }) => change(id, false));

  handle("clients:reveal", async ({ id, target }) => {
    const context = contextFor(gateway);
    if (target === "backups") {
      const dir = join(context.backups, id);
      await mkdir(dir, { recursive: true });
      return open(dir);
    }

    const { file, dir } = pick(clientOf(id).locate(context.env));
    return existsSync(file) ? shell.showItemInFolder(file) : open(dir);
  });

  return {
    sync: () =>
      serially(async () => {
        const context = contextFor(gateway);

        for (const client of CLIENTS) {
          try {
            if ((await inspect(client, context)).status === "outdated") await write(client, context, true);
          } catch (error) {
            console.error(`Couldn't update ${client.name}'s config:`, error instanceof Error ? error.message : error);
          }
        }

        emit("clients:changed");
      })
  };
}
