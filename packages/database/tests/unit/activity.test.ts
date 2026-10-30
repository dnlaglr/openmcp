import { beforeEach, expect, test } from "vitest";

import {
  activity,
  createDatabase,
  migrationsFolder,
  pruneActivity,
  recordActivity,
  type Database,
  type NewActivity
} from "../../src";

const call = (at: Date): NewActivity => ({
  at,
  serverId: "4f8b6a3e-9c1d-4e2f-8a7b-1c2d3e4f5a6b",
  serverName: "github",
  kind: "tool",
  name: "create_issue",
  client: "claude-code",
  durationMs: 42,
  outcome: "ok"
});

let db: Database;
beforeEach(() => {
  db = createDatabase({ path: ":memory:", migrationsFolder });
});

test("records calls, including ones no server could take", () => {
  const at = new Date("2026-10-29T12:00:00Z");

  recordActivity(db, call(at));
  recordActivity(db, {
    ...call(at),
    serverId: null,
    serverName: null,
    name: "github__missing",
    outcome: "unavailable",
    error: "Unknown tool github__missing"
  });

  expect(db.select().from(activity).all()).toEqual([
    { ...call(at), id: 1, error: null },
    {
      ...call(at),
      id: 2,
      serverId: null,
      serverName: null,
      name: "github__missing",
      outcome: "unavailable",
      error: "Unknown tool github__missing"
    }
  ]);
});

test("rejects an outcome outside the known set", () => {
  expect(() => recordActivity(db, { ...call(new Date()), outcome: "maybe" as NewActivity["outcome"] })).toThrow();
});

test("prunes only rows older than the cutoff", () => {
  const cutoff = new Date("2026-10-01T00:00:00Z");
  recordActivity(db, call(new Date("2026-09-30T23:59:59Z")));
  recordActivity(db, call(cutoff));

  expect(pruneActivity(db, cutoff)).toBe(1);
  expect(
    db
      .select()
      .from(activity)
      .all()
      .map((row) => row.at)
  ).toEqual([cutoff]);
});
