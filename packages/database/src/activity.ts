import { and, asc, desc, eq, gte, lt, max, ne, or } from "drizzle-orm";

import type {
  ActivityBucket,
  ActivityCall,
  ActivityCursor,
  ActivityGroup,
  ActivityStats,
  ActivitySummary
} from "@openmcp/contracts";

import { activity, type ActivityRow, type NewActivity } from "./schema";
import type { Database } from "./client";

const MAX_ERROR_LENGTH = 1000;

export type ActivityFilter = { since: Date; serverId?: string; call?: ActivityCall; groupBy?: "server" | "call" };
export type ActivityListOptions = ActivityFilter & { failuresOnly: boolean; before?: ActivityCursor; limit: number };

type Sample = Pick<ActivityRow, "serverId" | "serverName" | "kind" | "name" | "durationMs" | "outcome">;

const capped = (error: string | null | undefined) =>
  error && error.length > MAX_ERROR_LENGTH ? `${error.slice(0, MAX_ERROR_LENGTH - 1)}…` : error;

export function recordActivity(db: Database, row: NewActivity): void {
  db.insert(activity)
    .values({ ...row, error: capped(row.error) })
    .run();
}

export function pruneActivity(db: Database, before: Date): number {
  return Number(db.delete(activity).where(lt(activity.at, before)).run().changes);
}

function inScope({ since, serverId, call }: ActivityFilter) {
  return [
    gte(activity.at, since),
    serverId ? eq(activity.serverId, serverId) : undefined,
    call ? and(eq(activity.kind, call.kind), eq(activity.name, call.name)) : undefined
  ];
}

export function listActivity(db: Database, { failuresOnly, before, limit, ...filter }: ActivityListOptions) {
  return db
    .select()
    .from(activity)
    .where(
      and(
        ...inScope(filter),
        failuresOnly ? ne(activity.outcome, "ok") : undefined,
        before ? or(lt(activity.at, before.at), and(eq(activity.at, before.at), lt(activity.id, before.id))) : undefined
      )
    )
    .orderBy(desc(activity.at), desc(activity.id))
    .limit(limit)
    .all();
}

function percentile(sorted: number[], percent: number) {
  return sorted.length === 0 ? null : sorted[Math.ceil((sorted.length * percent) / 100) - 1];
}

function stats(samples: Sample[]): ActivityStats {
  const durations = samples.filter((sample) => sample.outcome !== "unavailable").map((sample) => sample.durationMs);

  return {
    calls: samples.length,
    failures: samples.filter((sample) => sample.outcome !== "ok").length,
    p50: percentile(durations, 50),
    p95: percentile(durations, 95)
  };
}

const label = (group: ActivityGroup) => group.name ?? group.serverName ?? "";

export function summarizeActivity(db: Database, { call, groupBy, ...filter }: ActivityFilter): ActivitySummary {
  // Pulls every row in range on each refresh, fine for ~100k rows (30 days of personal use).
  // If that grows, move the percentiles into SQL with row_number() over (partition by …).
  const samples = db
    .select({
      serverId: activity.serverId,
      serverName: activity.serverName,
      kind: activity.kind,
      name: activity.name,
      durationMs: activity.durationMs,
      outcome: activity.outcome
    })
    .from(activity)
    .where(and(...inScope(filter)))
    .orderBy(asc(activity.durationMs))
    .all();

  const byCall = groupBy ? groupBy === "call" : filter.serverId !== undefined;
  const grouped = new Map<string | null, Sample[]>();
  for (const sample of samples) {
    const key = byCall ? `${sample.serverId}:${sample.kind}:${sample.name}` : sample.serverId;
    const group = grouped.get(key);

    if (group) group.push(sample);
    else grouped.set(key, [sample]);
  }

  const groups = [...grouped.values()].map((rows): ActivityGroup => ({
    serverId: rows[0].serverId,
    serverName: rows[0].serverName,
    kind: byCall ? rows[0].kind : null,
    name: byCall ? rows[0].name : null,
    ...stats(rows)
  }));
  groups.sort(
    (a, b) =>
      Number(a.serverId === null) - Number(b.serverId === null) || b.calls - a.calls || label(a).localeCompare(label(b))
  );

  const selected = call ? samples.filter((sample) => sample.kind === call.kind && sample.name === call.name) : samples;
  return { totals: stats(selected), groups };
}

export type ActivitySeriesOptions = Omit<ActivityFilter, "since" | "groupBy"> & {
  end: Date;
  count: number;
  ms: number;
};

export function seriesActivity(db: Database, { end, count, ms, ...filter }: ActivitySeriesOptions): ActivityBucket[] {
  const start = end.getTime() - count * ms;
  const buckets = Array.from({ length: count }, (_, index) => ({
    at: new Date(start + index * ms),
    calls: 0,
    failures: 0
  }));

  const rows = db
    .select({ at: activity.at, outcome: activity.outcome })
    .from(activity)
    .where(and(...inScope({ since: new Date(start), ...filter }), lt(activity.at, end)))
    .all();

  for (const row of rows) {
    const bucket = buckets[Math.floor((row.at.getTime() - start) / ms)];
    bucket.calls += 1;
    if (row.outcome !== "ok") bucket.failures += 1;
  }

  return buckets;
}

export function lastCallByClient(db: Database): { client: string; at: Date }[] {
  return db
    .select({ client: activity.client, at: max(activity.at) })
    .from(activity)
    .groupBy(activity.client)
    .all()
    .flatMap(({ client, at }) => (client !== null && at !== null ? [{ client, at }] : []));
}
