import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

import type { LaunchSpec } from "@openmcp/contracts";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date())
};

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
});

export const installedServers = sqliteTable("installed_servers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  source: text("source", { enum: ["registry", "custom"] }).notNull(),
  registryName: text("registry_name"),
  version: text("version"),
  launch: text("launch", { mode: "json" }).$type<LaunchSpec>().notNull(),
  autostart: integer("autostart", { mode: "boolean" }).notNull().default(false),
  ...timestamps
}, (table) => [
  check("source_values", sql`${table.source} in ('registry', 'custom')`),
  check("registry_fields", sql`${table.source} = 'custom' or (${table.registryName} is not null and ${table.version} is not null)`)
]);

export type InstalledServerRow = typeof installedServers.$inferSelect;
export type NewInstalledServer = typeof installedServers.$inferInsert;
