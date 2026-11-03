import { loadShellPath } from "./shellPath";
import { checkRuntimes } from "./runtimes";
import { handle } from "../ipc";

export function registerSystemHandlers() {
  handle("system:runtimes", () => loadShellPath().then(checkRuntimes));
}
