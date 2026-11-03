import { listServers, setAutostart, type Database } from "@openmcp/database";
import type { NewCustomServer } from "@openmcp/contracts";

import { addCustomServer, deleteServer, editServer } from "./servers";
import type { Catalog } from "../gateway/catalog";
import type { Supervisor } from "./supervisor";
import { describeServer } from "./connection";
import type { SignIn } from "./signIn";
import { emit, handle } from "../ipc";
import { hasTokens } from "./oauth";

export function registerServerHandlers(
  db: Database,
  supervisor: Supervisor,
  oauth: SignIn,
  catalog: Pick<Catalog, "counts">
) {
  handle("servers:list", () => listServers(db));

  function add(input: NewCustomServer) {
    const server = addCustomServer(db, input);
    emit("servers:changed");

    if (server.autostart) void supervisor.start(server.id).then(() => oauth.signInIfNeeded(server.id));
    return server;
  }
  handle("servers:addCustom", add);

  handle("servers:update", (input) => {
    const server = editServer(db, input);
    emit("servers:changed");

    void supervisor.restartIfActive(server.id);
    return server;
  });

  handle("servers:setAutostart", ({ id, autostart }) => {
    if (!setAutostart(db, id, autostart)) throw new Error("That server no longer exists.");
    emit("servers:changed");
  });

  handle("servers:remove", async ({ id }) => {
    await oauth.cancel(id);
    await supervisor.remove(id);

    deleteServer(db, id);
    emit("servers:changed");
  });

  handle("servers:start", ({ id }) => supervisor.start(id));
  handle("servers:stop", ({ id }) => supervisor.stop(id));
  handle("servers:restart", ({ id }) => supervisor.restart(id));
  handle("servers:states", () => supervisor.states());
  handle("servers:counts", () => catalog.counts());
  handle("servers:logs", ({ id }) => supervisor.logs(id));

  handle("servers:signIn", ({ id }) => oauth.signIn(id));
  handle("servers:signOut", ({ id }) => oauth.signOut(id));
  handle("servers:signedIn", () =>
    listServers(db)
      .filter((server) => server.launch.type === "http" && hasTokens(server.id))
      .map((server) => server.id)
  );

  handle("servers:details", ({ id }) => {
    const client = supervisor.client(id);
    if (!client) throw new Error("Start the server to see what it exposes.");

    return describeServer(client);
  });

  return { add };
}
