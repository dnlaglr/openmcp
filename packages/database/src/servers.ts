import { eq } from "drizzle-orm";

import { installedServers, type InstalledServerRow, type NewInstalledServer } from "./schema";
import type { Database } from "./client";


export function listServers(db: Database): InstalledServerRow[] {
  return db.select().from(installedServers).orderBy(installedServers.name).all();
}


export function getServer(db: Database, id: string): InstalledServerRow | undefined {
  return db.select().from(installedServers).where(eq(installedServers.id, id)).get();
}


export function addServer(db: Database, server: NewInstalledServer): InstalledServerRow {
  return db.insert(installedServers).values(server).returning().get();
}


export function removeServer(db: Database, id: string): boolean {
  return db.delete(installedServers).where(eq(installedServers.id, id)).run().changes > 0;
}
