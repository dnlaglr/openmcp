import { beforeEach, expect, test } from "vitest";

import { createDatabase, migrationsFolder, setSetting, type Database } from "@openmcp/database";
import type { Appearance } from "@openmcp/contracts";

import { loadAppearance, saveAppearance } from "../../src/main/appearance";

let db: Database;
beforeEach(() => {
  db = createDatabase({ path: ":memory:", migrationsFolder });
});

const theme = (themeSource: Appearance) => ({ themeSource });

test("applies a saved appearance on the next launch", () => {
  saveAppearance(db, theme("system"), "dark");

  const next = theme("system");
  loadAppearance(db, next);
  expect(next.themeSource).toBe("dark");
});

test("applies the choice right away", () => {
  const current = theme("system");
  saveAppearance(db, current, "light");
  expect(current.themeSource).toBe("light");
});

test("follows the system when nothing valid is saved", () => {
  const fresh = theme("dark");
  loadAppearance(db, fresh);
  expect(fresh.themeSource).toBe("system");

  setSetting(db, "appearance", "purple");
  loadAppearance(db, fresh);
  expect(fresh.themeSource).toBe("system");
});
