import { app } from "electron";

import { handle } from "./ipc";


export function registerHandlers() {
  handle("app:version", () => app.getVersion());
}
