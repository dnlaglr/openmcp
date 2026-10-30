import { listActivity, recordActivity, summarizeActivity, type Database, type NewActivity } from "@openmcp/database";
import { ACTIVITY_PAGE_SIZE, ACTIVITY_RANGE_MS, type ActivityRange } from "@openmcp/contracts";

import { emit, handle } from "../ipc";

const CHANGED_DELAY_MS = 1000;

const since = (range: ActivityRange) => new Date(Date.now() - ACTIVITY_RANGE_MS[range]);

export function registerActivityHandlers(db: Database) {
  let changed: ReturnType<typeof setTimeout> | undefined;

  handle("activity:summary", ({ range, ...scope }) => summarizeActivity(db, { since: since(range), ...scope }));
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
