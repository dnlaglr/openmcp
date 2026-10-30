import { listServers, type Database } from "@openmcp/database";

import { addCustomServer, deleteServer, editServer } from "./servers";
import type { Supervisor } from "./supervisor";
import { describeServer } from "./connection";
import { emit, handle } from "../ipc";

export function registerServerHandlers(db: Database, supervisor: Supervisor) {
  handle("servers:list", () => listServers(db));

  handle("servers:addCustom", (input) => {
    const server = addCustomServer(db, input);
    emit("servers:changed");

    if (server.autostart) void supervisor.start(server.id);
    return server;
  });

  handle("servers:update", (input) => {
    const server = editServer(db, input);
    emit("servers:changed");

    const status = supervisor.states().find((state) => state.id === server.id)?.status;
    if (status === "starting" || status === "running") void supervisor.restart(server.id);
    return server;
  });

  handle("servers:remove", async ({ id }) => {
    await supervisor.remove(id);

    deleteServer(db, id);
    emit("servers:changed");
  });

  handle("servers:start", ({ id }) => supervisor.start(id));
  handle("servers:stop", ({ id }) => supervisor.stop(id));
  handle("servers:restart", ({ id }) => supervisor.restart(id));
  handle("servers:states", () => supervisor.states());
  handle("servers:logs", ({ id }) => supervisor.logs(id));

  handle("servers:details", ({ id }) => {
    const client = supervisor.client(id);
    if (!client) throw new Error("Start the server to see what it exposes.");

    return describeServer(client);
  });
}
