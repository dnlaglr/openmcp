import { fileURLToPath } from "node:url";
import { beforeEach, expect, test } from "vitest";

import { createDatabase, type Database } from "../../src";

const migrationsFolder = fileURLToPath(new URL("../../migrations", import.meta.url));

let db: Database;
beforeEach(() => { db = createDatabase({ path: ":memory:", migrationsFolder }); });

test("applies every migration to a fresh database", () => {
  const tables = db.$client.prepare("select name from sqlite_master where type = 'table'").all().map((row) => row.name);
  expect(tables).toEqual(expect.arrayContaining(["settings", "installed_servers"]));
});

test("enables foreign key enforcement", () => {
  expect(db.$client.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
});
