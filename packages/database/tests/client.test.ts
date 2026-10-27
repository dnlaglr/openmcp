import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import { createDatabase, getSetting, setSetting } from "../src";

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

test("migrates a fresh database and upserts settings", () => {
  const db = createDatabase({ path: ":memory:", migrationsFolder });
  expect(getSetting(db, "theme")).toBeNull();

  setSetting(db, "theme", "dark");
  setSetting(db, "theme", "light");
  expect(getSetting(db, "theme")).toBe("light");
})
