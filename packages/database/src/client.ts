import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { drizzle } from "drizzle-orm/node-sqlite";
import { DatabaseSync } from "node:sqlite";
import { eq } from "drizzle-orm";

import { settings } from "./schema";


export function createDatabase({ path, migrationsFolder }: { path: string; migrationsFolder: string; }) {
  const client = new DatabaseSync(path);
  client.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  const database = drizzle({ client });
  migrate(database, { migrationsFolder });
  
  return database;
}


export type Database = ReturnType<typeof createDatabase>;


export function getSetting(db: Database, key: string): string | null {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}


export function setSetting(db: Database, key: string, value: string): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
    .run();
}
