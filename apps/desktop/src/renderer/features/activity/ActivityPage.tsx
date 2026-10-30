import { Activity } from "lucide-react";
import { useState } from "react";

import { ActivityRange, type ActivityScope } from "@openmcp/contracts";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ActivityBreadcrumb, ActivityBreakdown, type Drill } from "./ActivityBreakdown";
import { formatCount, formatDuration, formatRate } from "./activityFormat";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { useActivitySummary } from "./useActivity";
import { ipcErrorMessage } from "@/lib/ipcError";
import { ActivityTrail } from "./ActivityTrail";
import { Stat } from "@/components/Stat";

const spans: Record<ActivityRange, string> = { "1h": "hour", "24h": "24 hours", "7d": "7 days", "30d": "30 days" };

function ActivityContent({
  scope,
  drill,
  onDrill
}: {
  scope: ActivityScope;
  drill: Drill;
  onDrill: (drill: Drill) => void;
}) {
  const { data: summary, error, isPending } = useActivitySummary(scope);

  if (isPending) return null;
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {ipcErrorMessage(error)}
      </p>
    );

  if (summary.groups.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {drill.server && <ActivityBreadcrumb drill={drill} onDrill={onDrill} />}
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Activity />
            </EmptyMedia>
            <EmptyTitle>No calls in the last {spans[scope.range]}</EmptyTitle>
            <EmptyDescription>Calls your agents make through the gateway show up here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const { totals } = summary;

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl bg-muted/50 p-4 sm:grid-cols-4">
        <Stat label="Calls">{formatCount(totals.calls)}</Stat>
        <Stat label="Failed">
          {formatRate(totals.failures, totals.calls)}
          <span className="font-normal text-muted-foreground"> · {formatCount(totals.failures)}</span>
        </Stat>
        <Stat label="Median">{formatDuration(totals.p50)}</Stat>
        <Stat label="p95">{formatDuration(totals.p95)}</Stat>
      </dl>
      <ActivityBreakdown groups={summary.groups} drill={drill} onDrill={onDrill} />
      <ActivityTrail scope={scope} />
    </div>
  );
}

export function ActivityPage() {
  const [range, setRange] = useState<ActivityRange>("24h");
  const [drill, setDrill] = useState<Drill>({});
  const scope: ActivityScope = { range, serverId: drill.server?.id, call: drill.call };

  return (
    <>
      <PageHeader
        title="Activity"
        description="Calls your agents made through the gateway."
        actions={
          <Tabs value={range} onValueChange={setRange}>
            <TabsList>
              {ActivityRange.options.map((option) => (
                <TabsTrigger key={option} value={option}>
                  {option}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />
      <ActivityContent scope={scope} drill={drill} onDrill={setDrill} />
    </>
  );
}
