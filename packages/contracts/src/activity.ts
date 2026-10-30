import { z } from "zod";

const HOUR_MS = 60 * 60 * 1000;

export const ACTIVITY_PAGE_SIZE = 100;

export const ActivityKind = z.enum(["tool", "prompt", "resource"]);
export type ActivityKind = z.infer<typeof ActivityKind>;

export const ActivityOutcome = z.enum(["ok", "tool_error", "error", "unavailable"]);
export type ActivityOutcome = z.infer<typeof ActivityOutcome>;

export const ActivityRange = z.enum(["1h", "24h", "7d", "30d"]);
export type ActivityRange = z.infer<typeof ActivityRange>;

export const ACTIVITY_RANGE_MS: Record<ActivityRange, number> = {
  "1h": HOUR_MS,
  "24h": 24 * HOUR_MS,
  "7d": 7 * 24 * HOUR_MS,
  "30d": 30 * 24 * HOUR_MS
};

export const ActivityCall = z.object({ kind: ActivityKind, name: z.string() });
export type ActivityCall = z.infer<typeof ActivityCall>;

export const ActivityScope = z.object({
  range: ActivityRange,
  serverId: z.uuid().optional(),
  call: ActivityCall.optional()
});
export type ActivityScope = z.infer<typeof ActivityScope>;

export const ActivityCursor = z.object({ at: z.date(), id: z.int() });
export type ActivityCursor = z.infer<typeof ActivityCursor>;

export const ActivityQuery = ActivityScope.extend({ failuresOnly: z.boolean(), before: ActivityCursor.optional() });

export const ActivityStats = z.object({
  calls: z.int(),
  failures: z.int(),
  p50: z.int().nullable(),
  p95: z.int().nullable()
});
export type ActivityStats = z.infer<typeof ActivityStats>;

export const ActivityGroup = ActivityStats.extend({
  serverId: z.uuid().nullable(),
  serverName: z.string().nullable(),
  kind: ActivityKind.nullable(),
  name: z.string().nullable()
});
export type ActivityGroup = z.infer<typeof ActivityGroup>;

export const ActivitySummary = z.object({ totals: ActivityStats, groups: z.array(ActivityGroup) });
export type ActivitySummary = z.infer<typeof ActivitySummary>;

export const ActivityEntry = z.object({
  id: z.int(),
  at: z.date(),
  serverId: z.uuid().nullable(),
  serverName: z.string().nullable(),
  kind: ActivityKind,
  name: z.string(),
  client: z.string().nullable(),
  durationMs: z.int(),
  outcome: ActivityOutcome,
  error: z.string().nullable()
});
export type ActivityEntry = z.infer<typeof ActivityEntry>;
