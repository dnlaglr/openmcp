import { getSetting, setSetting, type Database } from "@openmcp/database";
import { Appearance } from "@openmcp/contracts";

const KEY = "appearance";

export type ThemeSource = { themeSource: Appearance };

export function loadAppearance(db: Database, theme: ThemeSource) {
  const saved = Appearance.safeParse(getSetting(db, KEY));
  theme.themeSource = saved.success ? saved.data : "system";
}

export function saveAppearance(db: Database, theme: ThemeSource, appearance: Appearance) {
  setSetting(db, KEY, appearance);
  theme.themeSource = appearance;
}
