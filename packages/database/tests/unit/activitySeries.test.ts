import { beforeEach, expect, test } from "vitest";

import {
  createDatabase,
  migrationsFolder,
  recordActivity,
  seriesActivity,
  type Database,
  type NewActivity
} from "../../src";

const github = "4f8b6a3e-9c1d-4e2f-8a7b-1c2d3e4f5a6b";
const minute = 60_000;
const end = new Date("2026-10-31T12:00:00Z");
const before = (minutes: number) => new Date(end.getTime() - minutes * minute);

const call = (at: Date, outcome: NewActivity["outcome"] = "ok"): NewActivity => ({
  at,
  serverId: github,
  serverName: "github",
  kind: "tool",
  name: "create_issue",
  client: "claude-code",
  durationMs: 42,
  outcome
});

let db: Database;
beforeEach(() => {
  db = createDatabase({ path: ":memory:", migrationsFolder });
});

test("returns empty buckets", () => {
  expect(seriesActivity(db, { end, count: 3, ms: minute })).toEqual([
    { at: before(3), calls: 0, failures: 0 },
    { at: before(2), calls: 0, failures: 0 },
    { at: before(1), calls: 0, failures: 0 }
  ]);
});

test("counts calls and failures into their buckets", () => {
  recordActivity(db, call(before(3)));
  recordActivity(db, call(new Date(before(3).getTime() + 30_000), "error"));
  recordActivity(db, call(new Date(before(1).getTime() + 30_000), "tool_error"));
  recordActivity(db, call(end));
  recordActivity(db, call(before(4)));

  expect(seriesActivity(db, { end, count: 3, ms: minute })).toEqual([
    { at: before(3), calls: 2, failures: 1 },
    { at: before(2), calls: 0, failures: 0 },
    { at: before(1), calls: 1, failures: 1 }
  ]);
});

test("narrows to a server", () => {
  recordActivity(db, call(before(1)));
  recordActivity(db, { ...call(before(1), "unavailable"), serverId: null, serverName: null });

  expect(seriesActivity(db, { end, count: 1, ms: minute, serverId: github })).toEqual([
    { at: before(1), calls: 1, failures: 0 }
  ]);
});
