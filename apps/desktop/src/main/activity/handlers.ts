import {
  listActivity,
  recordActivity,
  seriesActivity,
  summarizeActivity,
  type Database,
  type NewActivity
} from "@openmcp/database";
import { ACTIVITY_BUCKETS, ACTIVITY_PAGE_SIZE, ACTIVITY_RANGE_MS, type ActivityRange } from "@openmcp/contracts";

import { emit, handle } from "../ipc";

const CHANGED_DELAY_MS = 1000;

const since = (range: ActivityRange) => new Date(Date.now() - ACTIVITY_RANGE_MS[range]);

export const bucketEnd = (now: number, ms: number, offsetMs: number) =>
  new Date(Math.floor((now - offsetMs) / ms) * ms + offsetMs + ms);

export function registerActivityHandlers(db: Database) {
  let changed: ReturnType<typeof setTimeout> | undefined;

  handle("activity:summary", ({ range, ...scope }) => summarizeActivity(db, { since: since(range), ...scope }));
  handle("activity:series", ({ range, ...scope }) => {
    const { count, ms } = ACTIVITY_BUCKETS[range];
    const end = bucketEnd(Date.now(), ms, new Date().getTimezoneOffset() * 60_000);
    return seriesActivity(db, { end, count, ms, ...scope });
  });
  handle("activity:list", ({ range, ...query }) =>
    listActivity(db, { since: since(range), limit: ACTIVITY_PAGE_SIZE, ...query })
  );

  return {
    record(row: NewActivity) {
      recordActivity(db, row);

      changed ??= setTimeout(() => {
        changed = undefined;
        emit("activity:changed");
      }, CHANGED_DELAY_MS);
    }
  };
}
