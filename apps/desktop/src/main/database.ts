import { join } from "node:path";
import { app } from "electron";

import { createDatabase } from "@openmcp/database";

export function openDatabase() {
  const migrationsFolder = app.isPackaged
    ? join(process.resourcesPath, "migrations")
    : join(app.getAppPath(), "../../packages/database/migrations");

  return createDatabase({ path: join(app.getPath("userData"), "openmcp.db"), migrationsFolder });
}
