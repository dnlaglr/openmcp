import type { CatalogRunner, Runtimes } from "@openmcp/contracts";

export type RuntimeInfo = { key: keyof Runtimes; name: string; url: string; prefix: string };

export type RuntimeCheck = {
  runner: CatalogRunner;
  info: RuntimeInfo;
  found: boolean;
  ready: boolean;
  version: string | null;
};

export const RUNTIMES: Partial<Record<CatalogRunner, RuntimeInfo>> = {
  npx: { key: "node", name: "Node.js", url: "https://nodejs.org/en/download", prefix: "v" },
  uvx: { key: "uv", name: "uv", url: "https://docs.astral.sh/uv/getting-started/installation/", prefix: "" },
  docker: { key: "docker", name: "Docker", url: "https://docs.docker.com/get-started/get-docker/", prefix: "" }
};

export function checkRunner(runner: CatalogRunner, runtimes: Runtimes | undefined): RuntimeCheck | null {
  const info = RUNTIMES[runner];
  if (!info || !runtimes) return null;

  const runtime = runtimes[info.key];
  const running = "running" in runtime ? runtime.running : true;
  return {
    runner,
    info,
    found: runtime.found,
    ready: runtime.found && running,
    version: runtime.version && `${info.prefix}${runtime.version}`
  };
}
