import { listServers, type Database } from "@openmcp/database";

import { addCustomServer, deleteServer } from "./servers";
import { emit, handle } from "../ipc";


export function registerServerHandlers(db: Database) {
  handle("servers:list", () => listServers(db));
  
  handle("servers:addCustom", (input) => {
    const server = addCustomServer(db, input);
    emit("servers:changed");
    return server;
  });
  
  handle("servers:remove", ({ id }) => {
    deleteServer(db, id);
    emit("servers:changed");
  });
}
