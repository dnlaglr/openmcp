import { beforeEach, expect, test } from "vitest";

import {
  activity,
  createDatabase,
  listActivity,
  migrationsFolder,
  pruneActivity,
  recordActivity,
  summarizeActivity,
  type ActivityListOptions,
  type ActivityRow,
  type Database,
  type NewActivity
} from "../../src";

const github = "4f8b6a3e-9c1d-4e2f-8a7b-1c2d3e4f5a6b";
const files = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
const memory = "c0ffee00-1234-4abc-8def-0123456789ab";

const call = (at: Date): NewActivity => ({
  at,
  serverId: github,
  serverName: "github",
  kind: "tool",
  name: "create_issue",
  client: "claude-code",
  durationMs: 42,
  outcome: "ok"
});

const unavailable = (at: Date): NewActivity => ({
  ...call(at),
  serverId: null,
  serverName: null,
  name: "linear__create_issue",
  durationMs: 0,
  outcome: "unavailable",
  error: "Unknown tool linear__create_issue"
});

const now = new Date("2026-10-29T12:00:00Z");
const since = new Date("2026-10-29T11:00:00Z");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

const names = (rows: ActivityRow[]) => rows.map((row) => row.name);
const list = (options: Partial<ActivityListOptions> = {}) =>
  listActivity(db, { since, failuresOnly: false, limit: 100, ...options });

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

test("caps error messages at 1,000 characters", () => {
  recordActivity(db, { ...call(now), outcome: "error", error: "x".repeat(1500) });
  recordActivity(db, { ...call(now), outcome: "error", error: "y".repeat(1000) });
  recordActivity(db, { ...call(now), outcome: "error", error: "😀".repeat(600) });

  const [long, exact, emoji] = db
    .select()
    .from(activity)
    .all()
    .map((row) => row.error);
  expect(long).toBe(`${"x".repeat(999)}…`);
  expect(exact).toBe("y".repeat(1000));
  expect(emoji?.length).toBeLessThanOrEqual(1000);
});

test("lists calls newest first by start time, even when a long call finished last", () => {
  recordActivity(db, { ...call(minutesAgo(1)), name: "quick" });
  recordActivity(db, { ...call(minutesAgo(5)), name: "slow", durationMs: 240_000 });
  recordActivity(db, { ...call(minutesAgo(90)), name: "too_old" });

  expect(names(list())).toEqual(["quick", "slow"]);
});

test("pages through calls that share a start time without skipping or repeating any", () => {
  for (const name of ["a", "b", "c"]) recordActivity(db, { ...call(minutesAgo(2)), name });
  for (const name of ["d", "e"]) recordActivity(db, { ...call(minutesAgo(1)), name });

  const after = (rows: ActivityRow[]) => ({ at: rows[1].at, id: rows[1].id });
  const first = list({ limit: 2 });
  const second = list({ limit: 2, before: after(first) });
  const third = list({ limit: 2, before: after(second) });

  expect([first, second, third].map(names)).toEqual([["e", "d"], ["c", "b"], ["a"]]);
});

test("scopes the trail to a server, a call, or failures", () => {
  recordActivity(db, call(minutesAgo(1)));
  recordActivity(db, { ...call(minutesAgo(2)), name: "list_issues", outcome: "tool_error" });
  recordActivity(db, {
    ...call(minutesAgo(3)),
    serverId: files,
    serverName: "filesystem",
    name: "read_file",
    outcome: "error",
    error: "ENOENT"
  });
  recordActivity(db, unavailable(minutesAgo(4)));

  expect(names(list({ serverId: github }))).toEqual(["create_issue", "list_issues"]);
  expect(names(list({ serverId: github, call: { kind: "tool", name: "list_issues" } }))).toEqual(["list_issues"]);
  expect(names(list({ failuresOnly: true }))).toEqual(["list_issues", "read_file", "linear__create_issue"]);
});

test("counts every outcome but ok as a failure, and takes nearest-rank latency from calls that reached a server", () => {
  for (let ms = 10; ms <= 190; ms += 10) recordActivity(db, { ...call(minutesAgo(1)), durationMs: ms });
  recordActivity(db, { ...call(minutesAgo(1)), durationMs: 200, outcome: "tool_error" });
  for (let i = 0; i < 3; i++) recordActivity(db, unavailable(minutesAgo(1)));

  expect(summarizeActivity(db, { since }).totals).toEqual({ calls: 23, failures: 4, p50: 100, p95: 190 });
});

test("reports no latency when no call reached a server", () => {
  recordActivity(db, unavailable(minutesAgo(1)));

  expect(summarizeActivity(db, { since }).totals).toEqual({ calls: 1, failures: 1, p50: null, p95: null });
});

test("groups by server, busiest first, with calls no server could take last", () => {
  const record = (serverId: string, serverName: string, count: number) => {
    for (let i = 0; i < count; i++) recordActivity(db, { ...call(minutesAgo(1)), serverId, serverName });
  };
  record(memory, "memory", 3);
  record(github, "github", 2);
  record(files, "filesystem", 2);
  for (let i = 0; i < 4; i++) recordActivity(db, unavailable(minutesAgo(1)));
  recordActivity(db, call(minutesAgo(90)));

  const server = (serverId: string, serverName: string, calls: number) => ({
    serverId,
    serverName,
    kind: null,
    name: null,
    calls,
    failures: 0,
    p50: 42,
    p95: 42
  });
  expect(summarizeActivity(db, { since }).groups).toEqual([
    server(memory, "memory", 3),
    server(files, "filesystem", 2),
    server(github, "github", 2),
    { serverId: null, serverName: null, kind: null, name: null, calls: 4, failures: 4, p50: null, p95: null }
  ]);
});

test("groups a server's calls by kind and name, and scopes the totals to the selected call", () => {
  recordActivity(db, call(minutesAgo(1)));
  recordActivity(db, { ...call(minutesAgo(1)), outcome: "tool_error" });
  recordActivity(db, { ...call(minutesAgo(1)), kind: "prompt" });
  recordActivity(db, { ...call(minutesAgo(1)), serverId: files, serverName: "filesystem", name: "read_file" });

  const summary = summarizeActivity(db, { since, serverId: github, call: { kind: "tool", name: "create_issue" } });

  expect(summary.totals).toEqual({ calls: 2, failures: 1, p50: 42, p95: 42 });
  expect(summary.groups).toEqual([
    {
      serverId: github,
      serverName: "github",
      kind: "tool",
      name: "create_issue",
      calls: 2,
      failures: 1,
      p50: 42,
      p95: 42
    },
    {
      serverId: github,
      serverName: "github",
      kind: "prompt",
      name: "create_issue",
      calls: 1,
      failures: 0,
      p50: 42,
      p95: 42
    }
  ]);
});
