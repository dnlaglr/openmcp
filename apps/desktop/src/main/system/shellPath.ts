import { execFile } from "node:child_process";
import { delimiter } from "node:path";
import { userInfo } from "node:os";

const MARK = "__OPENMCP_PATH__";
const TIMEOUT_MS = 5000;

export const mergePath = (shell: string, current = "") =>
  [...new Set([...shell.split(delimiter), ...current.split(delimiter)])].filter(Boolean).join(delimiter);

// Finder and Dock launches get launchd's bare PATH. Interactive + login, since version managers usually hook into .zshrc.
export function loadShellPath(): Promise<void> {
  if (process.platform === "win32") return Promise.resolve();

  const shell = process.env.SHELL || userInfo().shell || "/bin/sh";
  return new Promise((resolve) => {
    execFile(
      shell,
      ["-ilc", `printf '${MARK}%s${MARK}' "$PATH"`],
      // oh-my-zsh would otherwise stop to ask about updating.
      { timeout: TIMEOUT_MS, killSignal: "SIGKILL", env: { ...process.env, DISABLE_AUTO_UPDATE: "true" } },
      (_error, stdout) => {
        const path = stdout.split(MARK)[1];
        if (path) process.env.PATH = mergePath(path, process.env.PATH);
        resolve();
      }
    );
  });
}
