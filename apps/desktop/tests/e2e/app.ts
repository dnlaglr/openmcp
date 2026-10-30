import { _electron as electron } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const appDir = join(__dirname, "../..");

export const launch = (dataDir: string, env: Record<string, string> = {}) =>
  electron.launch({
    args: [appDir, `--user-data-dir=${dataDir}`],
    env: { ...(process.env as Record<string, string>), ...env }
  });

export async function withDataDir(run: (dataDir: string) => Promise<void>) {
  const dataDir = mkdtempSync(join(tmpdir(), "openmcp-e2e-"));

  try {
    await run(dataDir);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(`${dataDir}-dev`, { recursive: true, force: true });
  }
}
