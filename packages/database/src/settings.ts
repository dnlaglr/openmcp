import { eq } from "drizzle-orm";

import type { Database } from "./client";
import { settings } from "./schema";

export function getSetting(db: Database, key: string): string | null {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

export function setSetting(db: Database, key: string, value: string): void {
  const updatedAt = new Date();

  db.insert(settings)
    .values({ key, value, updatedAt })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt } })
    .run();
}
