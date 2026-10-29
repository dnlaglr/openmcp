import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { drizzle } from "drizzle-orm/node-sqlite";
import { DatabaseSync } from "node:sqlite";


export function createDatabase({ path, migrationsFolder }: { path: string; migrationsFolder: string; }) {
  const client = new DatabaseSync(path);
  client.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  const database = drizzle({ client });
  migrate(database, { migrationsFolder });
  
  return database;
}


export type Database = ReturnType<typeof createDatabase>;
