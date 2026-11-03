import { execFile } from "node:child_process";

import type { Runtime, Runtimes } from "@openmcp/contracts";

const TIMEOUT_MS = 3000;

export type Probe = { status: "ok" | "failed" | "missing" | "timeout"; stdout: string };

export function probe(command: string, args: string[], timeout = TIMEOUT_MS): Promise<Probe> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout, killSignal: "SIGKILL", windowsHide: true }, (error, stdout) => {
      if (!error) return resolve({ status: "ok", stdout });
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return resolve({ status: "missing", stdout: "" });
      resolve({ status: error.killed ? "timeout" : "failed", stdout });
    });
  });
}

export const parseVersion = (text: string) => text.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? null;

export function toRuntime({ status, stdout }: Probe): Runtime {
  const version = status === "ok" ? parseVersion(stdout) : null;
  return { found: version !== null, version };
}

export function toDocker({ status, stdout }: Probe): Runtimes["docker"] {
  if (status === "missing" || status === "timeout") return { found: false, version: null, running: false };
  return { found: true, version: status === "ok" ? parseVersion(stdout) : null, running: status === "ok" };
}

export async function checkRuntimes(): Promise<Runtimes> {
  const [node, uv, docker] = await Promise.all([
    probe("node", ["--version"]),
    probe("uv", ["--version"]),
    probe("docker", ["version", "--format", "{{.Server.Version}}"])
  ]);

  return { node: toRuntime(node), uv: toRuntime(uv), docker: toDocker(docker) };
}
