import { beforeEach, expect, test } from "vitest";

import { createDatabase, getSetting, migrationsFolder, setSetting, type Database } from "../../src";

let db: Database;
beforeEach(() => {
  db = createDatabase({ path: ":memory:", migrationsFolder });
});

test("returns null for a setting that was never saved", () => {
  expect(getSetting(db, "gateway.port")).toBeNull();
});

test("saves a setting and overwrites it", () => {
  setSetting(db, "gateway.port", "7465");
  setSetting(db, "gateway.port", "8123");

  expect(getSetting(db, "gateway.port")).toBe("8123");
});
