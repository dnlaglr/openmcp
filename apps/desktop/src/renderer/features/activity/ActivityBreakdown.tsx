import { ChevronRight } from "lucide-react";
import { cn } from "cn";

import type { ActivityCall, ActivityGroup } from "@openmcp/contracts";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCount, formatDuration, formatRate } from "./activityFormat";
import { Badge } from "@/components/ui/badge";

export type Drill = { server?: { id: string; name: string }; call?: ActivityCall };

type DrillProps = { drill: Drill; onDrill: (drill: Drill) => void };

const label = (group: ActivityGroup) => group.name ?? group.serverName ?? "No server";

const callOf = ({ kind, name }: ActivityGroup): ActivityCall | undefined =>
  kind && name !== null ? { kind, name } : undefined;

export function ActivityBreadcrumb({ drill, onDrill }: DrillProps) {
  const steps: { label: string; drill: Drill }[] = [{ label: "All servers", drill: {} }];
  if (drill.server) steps.push({ label: drill.server.name, drill: { server: drill.server } });
  if (drill.call) steps.push({ label: drill.call.name, drill });

  return (
    <nav aria-label="Breakdown" className="flex min-w-0 items-center gap-1 text-sm font-medium">
      {steps.map((step, index) => (
        <span key={index} className="flex min-w-0 items-center gap-1">
          {index > 0 && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
          {index === steps.length - 1 ? (
            <span aria-current="page" className="truncate">
              {step.label}
            </span>
          ) : (
            <button
              type="button"
              className="truncate rounded-sm text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
              onClick={() => onDrill(step.drill)}
            >
              {step.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}

export function ActivityBreakdown({ groups, drill, onDrill }: DrillProps & { groups: ActivityGroup[] }) {
  const byCall = drill.server !== undefined;
  const selected = (group: ActivityGroup) => group.kind === drill.call?.kind && group.name === drill.call?.name;

  function open(group: ActivityGroup) {
    const call = callOf(group);

    if (call) onDrill({ server: drill.server, call: selected(group) ? undefined : call });
    else if (group.serverId) onDrill({ server: { id: group.serverId, name: label(group) } });
  }

  return (
    <section className="flex flex-col gap-2">
      <ActivityBreadcrumb drill={drill} onDrill={onDrill} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{byCall ? "Call" : "Server"}</TableHead>
            <TableHead className="text-right">Calls</TableHead>
            <TableHead className="text-right">Failed</TableHead>
            <TableHead className="text-right">Median</TableHead>
            <TableHead className="text-right">p95</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {groups.map((group) => {
            const drillable = byCall || group.serverId !== null;

            return (
              <TableRow
                key={`${group.serverId}:${group.kind}:${group.name}`}
                data-state={selected(group) ? "selected" : undefined}
                className={cn(drillable && "cursor-pointer")}
                onClick={drillable ? () => open(group) : undefined}
              >
                <TableCell className="max-w-96 truncate font-medium">
                  {group.kind && (
                    <Badge variant="outline" className="mr-2">
                      {group.kind}
                    </Badge>
                  )}
                  {drillable ? (
                    <button
                      type="button"
                      aria-pressed={byCall ? selected(group) : undefined}
                      className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
                    >
                      {label(group)}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">{label(group)}</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(group.calls)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatRate(group.failures, group.calls)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatDuration(group.p50)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatDuration(group.p95)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
