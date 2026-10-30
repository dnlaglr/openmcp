import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { _electron as electron } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const appDir = join(__dirname, "../..");

export const launch = (dataDir: string, env: Record<string, string> = {}) =>
  electron.launch({
    args: [appDir, `--user-data-dir=${dataDir}`],
    env: { ...(process.env as Record<string, string>), ...env }
  });

export function databaseContents(dataDir: string) {
  const files = ["openmcp.db", "openmcp.db-wal"].map((file) => join(`${dataDir}-dev`, file)).filter(existsSync);
  return files.map((file) => readFileSync(file, "latin1")).join("");
}

export async function withDataDir(run: (dataDir: string) => Promise<void>) {
  const dataDir = mkdtempSync(join(tmpdir(), "openmcp-e2e-"));

  try {
    await run(dataDir);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(`${dataDir}-dev`, { recursive: true, force: true });
  }
}
