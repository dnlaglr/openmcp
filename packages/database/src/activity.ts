import { lt } from "drizzle-orm";

import { activity, type NewActivity } from "./schema";
import type { Database } from "./client";

export function recordActivity(db: Database, row: NewActivity): void {
  db.insert(activity).values(row).run();
}

export function pruneActivity(db: Database, before: Date): number {
  return Number(db.delete(activity).where(lt(activity.at, before)).run().changes);
}
