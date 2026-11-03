import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { activity, createDatabase, migrationsFolder, type Database, type NewActivity } from "@openmcp/database";

const emit = vi.hoisted(() => vi.fn());

vi.mock("../../src/main/ipc", () => ({ emit, handle: () => {} }));

const { bucketEnd, registerActivityHandlers } = await import("../../src/main/activity/handlers");

const row: NewActivity = {
  at: new Date("2026-10-29T12:00:00Z"),
  serverId: null,
  serverName: null,
  kind: "tool",
  name: "echo",
  client: null,
  durationMs: 1,
  outcome: "ok"
};

let db: Database;
beforeEach(() => {
  vi.useFakeTimers();
  emit.mockClear();
  db = createDatabase({ path: ":memory:", migrationsFolder });
});
afterEach(() => vi.useRealTimers());

test("records every call and tells windows once per burst", () => {
  const { record } = registerActivityHandlers(db);

  record(row);
  record(row);
  record(row);
  expect(emit).not.toHaveBeenCalled();

  vi.advanceTimersByTime(1000);
  expect(emit).toHaveBeenCalledExactlyOnceWith("activity:changed");
  expect(db.select().from(activity).all()).toHaveLength(3);

  record(row);
  vi.advanceTimersByTime(1000);
  expect(emit).toHaveBeenCalledTimes(2);
});

test("stays quiet when a call can't be recorded", () => {
  const { record } = registerActivityHandlers(db);

  expect(() => record({ ...row, outcome: "maybe" as NewActivity["outcome"] })).toThrow();
  vi.advanceTimersByTime(1000);
  expect(emit).not.toHaveBeenCalled();
});

test("ends the series at the next bucket boundary in local time", () => {
  const hour = 3_600_000;
  const now = Date.parse("2026-10-31T12:34:56Z");

  expect(bucketEnd(now, 30 * 60_000, 0)).toEqual(new Date("2026-10-31T13:00:00Z"));
  // UTC−7: local midnight is 07:00 UTC.
  expect(bucketEnd(now, 24 * hour, 7 * hour)).toEqual(new Date("2026-11-01T07:00:00Z"));
});
