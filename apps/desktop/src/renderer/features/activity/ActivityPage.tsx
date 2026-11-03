import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "cn";

import { ActivityRange, type ActivityScope } from "@openmcp/contracts";

import { formatAgo, formatCount, formatDuration, formatRate, RANGES } from "./activityFormat";
import { useActivitySeries, useActivitySummary, useActivityTrail } from "./useActivity";
import { useServers } from "@/features/servers/useServers";
import { ErrorState } from "@/components/ErrorState";
import { Segmented } from "@/components/Segmented";
import { TopLists, type Filter } from "./TopLists";
import type { PageProps } from "@/lib/navigation";
import { Skeleton } from "@/components/Skeleton";
import { ActivityChart } from "./ActivityChart";
import { Toolbar } from "@/components/Toolbar";
import { useNow } from "@/hooks/useNow";
import { CallLog } from "./CallLog";

const link = "text-xs font-medium text-primary hover:underline";

function LiveStatus({ newest }: { newest?: Date }) {
  const now = useNow(true);
  const [heard, setHeard] = useState<number | null>(null);

  useEffect(() => window.api.on("activity:changed", () => setHeard(Date.now())), []);

  const last = Math.max(heard ?? 0, newest?.getTime() ?? 0);
  if (last === 0) return "No calls yet";

  return (
    <>
      <span
        key={heard ?? "idle"}
        className="led animate-[led-pop_var(--d4)_var(--spring)]"
        data-status="running"
        aria-hidden
      />
      Live · last call {formatAgo(new Date(last), now)}
    </>
  );
}

function Chip({ kind, value, label, onClear }: { kind: string; value: string; label: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-6 animate-pop items-center gap-1.5 rounded-full bg-accent pr-1 pl-2.5 text-xs text-accent-foreground">
      <span className="opacity-70">{kind}</span>
      <b className="font-semibold">{value}</b>
      <button
        type="button"
        aria-label={label}
        onClick={onClear}
        className="grid size-4 place-items-center rounded-full outline-none hover:bg-tint-2 focus-visible:focus-halo"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function Kpi({ label, bad = false, children }: { label: string; bad?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-[10px] px-3.5 py-3 ring-1 ring-border transition-colors duration-(--d3)",
        bad && "bg-destructive/6 ring-destructive/25"
      )}
    >
      <dt className="text-[11px] font-semibold text-muted-foreground">{label}</dt>
      <dd className={cn("text-xl leading-6 font-semibold tabular-nums", bad && "text-destructive")}>{children}</dd>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="delayed flex flex-col gap-4">
      <Skeleton className="h-16 w-full rounded-[10px]" />
      <Skeleton className="h-[190px] w-full rounded-[10px]" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-[210px] w-full rounded-[10px]" />
        <Skeleton className="h-[210px] w-full rounded-[10px]" />
      </div>
    </div>
  );
}

export function ActivityPage({ navigate, params }: PageProps) {
  const [range, setRange] = useState<ActivityRange>("24h");
  const [filter, setFilter] = useState<Filter>(() => (params.serverId ? { serverId: params.serverId } : {}));
  const { data: servers = [] } = useServers();

  const scope: ActivityScope = { range, serverId: filter.serverId, call: filter.call };
  const summary = useActivitySummary(scope);
  const series = useActivitySeries(scope);
  const trail = useActivityTrail(scope, false);

  const copy = RANGES[range];
  const serverName =
    filter.serverId && (servers.find((server) => server.id === filter.serverId)?.name ?? "Removed server");
  const totals = summary.data?.totals;
  const rate = totals && totals.calls > 0 ? totals.failures / totals.calls : 0;

  let subtitle: ReactNode = "Loading…";
  if (summary.isSuccess) subtitle = <LiveStatus newest={trail.data?.pages[0]?.[0]?.at} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar title="Activity" subtitle={summary.error ? undefined : subtitle}>
        <Segmented
          label="Time range"
          options={ActivityRange.options.map((option) => ({ value: option, label: option }))}
          value={range}
          onChange={setRange}
        />
      </Toolbar>

      {summary.error ? (
        <ErrorState title="Couldn’t load activity" error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-6 pt-4 pb-8">
          <div className="flex min-h-6 flex-wrap items-center gap-2">
            {serverName ? (
              <>
                <Chip kind="Server" value={serverName} label="Remove the server filter" onClear={() => setFilter({})} />
                {filter.call && (
                  <Chip
                    kind="Tool"
                    value={filter.call.name}
                    label="Remove the tool filter"
                    onClear={() => setFilter({ serverId: filter.serverId })}
                  />
                )}
                <button type="button" className={link} onClick={() => setFilter({})}>
                  Clear
                </button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                Everything in the {copy.words}. Click a server or tool below to narrow it down.
              </span>
            )}
          </div>

          {totals ? (
            <>
              <dl className="grid grid-cols-4 gap-2.5">
                <Kpi label="Calls">
                  <span key={totals.calls} className="inline-block animate-up">
                    {formatCount(totals.calls)}
                  </span>
                </Kpi>
                <Kpi label="Failed" bad={rate >= 0.02}>
                  {formatRate(totals.failures, totals.calls)}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    {formatCount(totals.failures)}
                  </span>
                </Kpi>
                <Kpi label="Median">{formatDuration(totals.p50)}</Kpi>
                <Kpi label="p95">{formatDuration(totals.p95)}</Kpi>
              </dl>
              <ActivityChart range={range} buckets={series.data} onConnect={() => navigate("agents")} />
              <TopLists range={range} filter={filter} serverName={serverName || undefined} onFilter={setFilter} />
              <CallLog scope={scope} calls={totals.calls} words={copy.words} filtered={filter.serverId !== undefined} />
            </>
          ) : (
            <PageSkeleton />
          )}
        </div>
      )}
    </div>
  );
}
