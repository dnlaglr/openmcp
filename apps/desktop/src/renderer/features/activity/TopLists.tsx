import { cn } from "cn";

import type { ActivityCall, ActivityGroup, ActivityRange } from "@openmcp/contracts";

import { formatCompact, formatRate } from "./activityFormat";
import { useActivitySummary } from "./useActivity";

export type Filter = { serverId?: string; call?: ActivityCall };

type TopRow = {
  key: string;
  name: string;
  prefix?: string;
  group: ActivityGroup;
  on: boolean;
  dim: boolean;
  onPick?: () => void;
};

const caption = "text-[11px] font-semibold text-muted-foreground";

function TopCard({ title, rows, mono = false }: { title: string; rows: TopRow[]; mono?: boolean }) {
  const max = Math.max(1, ...rows.map((row) => row.group.calls));

  return (
    <section aria-label={title} className="flex flex-col gap-0.5 rounded-[10px] p-2.5 ring-1 ring-border">
      <div className="flex items-center justify-between px-1.5 pb-1.5">
        <h3 className={caption}>{title}</h3>
        <span className="text-xs text-muted-foreground">calls · failed</span>
      </div>
      {rows.map(({ key, name, prefix, group, on, dim, onPick }) => {
        const failing = group.calls > 0 && group.failures / group.calls >= 0.02;
        const content = (
          <>
            <span title={name} className={cn("truncate", mono && "font-mono text-xs")}>
              {prefix && <span className="text-muted-foreground">{prefix}</span>}
              {name}
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-tint-2">
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-(--d4) ease-(--ease-move) group-data-on:bg-white"
                style={{ width: `${Math.max(3, (group.calls / max) * 100)}%` }}
              />
            </span>
            <span className="text-right tabular-nums">{formatCompact(group.calls)}</span>
            <span className={cn("text-right text-muted-foreground tabular-nums", failing && "text-destructive")}>
              {formatRate(group.failures, group.calls)}
            </span>
          </>
        );
        const row = cn(
          "group grid h-8 w-full grid-cols-[minmax(0,1fr)_minmax(60px,1fr)_44px_48px] items-center gap-2.5 rounded-md px-1.5 text-left text-[13px] transition-[background-color,opacity] duration-(--d2)",
          on && "bg-primary text-primary-foreground [&_.text-muted-foreground]:text-white/80",
          dim && "opacity-50"
        );

        return onPick ? (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            data-on={on || undefined}
            className={cn(row, "outline-none hover:bg-tint-1 focus-visible:focus-halo")}
            onClick={onPick}
          >
            {content}
          </button>
        ) : (
          <div key={key} className={row}>
            {content}
          </div>
        );
      })}
      {rows.length === 0 && <p className="px-1.5 py-4 text-xs text-muted-foreground">Nothing yet</p>}
    </section>
  );
}

type TopListsProps = {
  range: ActivityRange;
  filter: Filter;
  serverName?: string;
  onFilter: (filter: Filter) => void;
};

export function TopLists({ range, filter, serverName, onFilter }: TopListsProps) {
  const { data: servers } = useActivitySummary({ range });
  const { data: tools } = useActivitySummary({ range, serverId: filter.serverId, groupBy: "call" });

  const serverRows = (servers?.groups ?? []).map((group): TopRow => {
    const on = group.serverId !== null && group.serverId === filter.serverId;
    const id = group.serverId;
    return {
      key: id ?? "none",
      name: group.serverName ?? "No server",
      group,
      on,
      dim: filter.serverId !== undefined && !on,
      onPick: id ? () => onFilter(on ? {} : { serverId: id }) : undefined
    };
  });

  const toolRows = (tools?.groups ?? []).slice(0, 6).map((group): TopRow => {
    const id = group.serverId;
    const call = group.kind && group.name !== null ? { kind: group.kind, name: group.name } : undefined;
    const on = id === filter.serverId && call?.kind === filter.call?.kind && call?.name === filter.call?.name;
    return {
      key: `${id}:${group.kind}:${group.name}`,
      name: group.name ?? "",
      prefix: filter.serverId ? undefined : `${group.serverName ?? "No server"} · `,
      group,
      on,
      dim: filter.call !== undefined && !on,
      onPick: id && call ? () => onFilter(on ? { serverId: id } : { serverId: id, call }) : undefined
    };
  });

  return (
    <div className="grid grid-cols-2 gap-4">
      <TopCard title="Top servers" rows={serverRows} />
      <TopCard title={serverName ? `Top tools in ${serverName}` : "Top tools"} rows={toolRows} mono />
    </div>
  );
}
