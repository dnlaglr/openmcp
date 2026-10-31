import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { afterEach, expect, test } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { addServer, createDatabase, listServers, migrationsFolder } from "../../src";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// The migrations as they were before launches had a type, so a row can be stored in the old shape.
function migrationsBeforeLaunchType() {
  const dir = mkdtempSync(join(tmpdir(), "openmcp-migrations-"));
  dirs.push(dir);
  cpSync(migrationsFolder, dir, { recursive: true });

  for (const name of readdirSync(dir).filter((name) => name.endsWith("_add_launch_type"))) {
    rmSync(join(dir, name), { recursive: true });
  }
  return dir;
}

test("tags launches stored before remote servers as stdio and leaves typed ones alone", () => {
  const folder = migrationsBeforeLaunchType();
  const path = join(folder, "openmcp.db");
  const remote = { type: "http" as const, url: "https://mcp.example.com/mcp", headers: {}, secretHeaders: [] };

  const before = createDatabase({ path, migrationsFolder: folder });
  before.$client
    .prepare(
      "insert into installed_servers (id, name, source, launch, autostart, created_at, updated_at) values (?, ?, 'custom', ?, 0, 0, 0)"
    )
    .run(crypto.randomUUID(), "old", JSON.stringify({ command: "npx", args: [], env: {}, secretEnv: [] }));
  addServer(before, { name: "remote", source: "custom", launch: remote });
  before.$client.close();

  // Closed before asserting, since Windows can't delete the folder of an open database.
  const after = createDatabase({ path, migrationsFolder });
  const launches = listServers(after).map((server) => server.launch);
  after.$client.close();

  expect(launches).toEqual([{ type: "stdio", command: "npx", args: [], env: {}, secretEnv: [] }, remote]);
});
