import { useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

import type { ActivityOutcome, ActivityScope } from "@openmcp/contracts";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActivityTrail, useLiveTrail, useVisibility } from "./useActivity";
import { formatDuration, formatWhen } from "./activityFormat";
import { ipcErrorMessage } from "@/lib/ipcError";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

const failures: Record<Exclude<ActivityOutcome, "ok">, { label: string; variant: "outline" | "destructive" }> = {
  tool_error: { label: "Tool error", variant: "outline" },
  error: { label: "Error", variant: "destructive" },
  unavailable: { label: "Unavailable", variant: "outline" }
};

function Outcome({ outcome }: { outcome: ActivityOutcome }) {
  if (outcome === "ok") return <span className="text-muted-foreground">OK</span>;

  const { label, variant } = failures[outcome];
  return <Badge variant={variant}>{label}</Badge>;
}

export function ActivityTrail({ scope }: { scope: ActivityScope }) {
  const [failuresOnly, setFailuresOnly] = useState(false);
  const trail = useActivityTrail(scope, failuresOnly);
  const top = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const hasNew = useLiveTrail(top);

  useVisibility(end, (visible) => {
    if (visible && trail.hasNextPage && !trail.isFetchingNextPage) void trail.fetchNextPage();
  });

  const entries = trail.data?.pages.flat() ?? [];

  return (
    <section className="flex flex-col gap-2">
      {hasNew && (
        <div className="sticky top-4 z-10 flex h-0 justify-center">
          <Button size="sm" onClick={() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            <ArrowUp />
            New calls
          </Button>
        </div>
      )}

      <div ref={top} className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Calls</h2>
        <div className="flex items-center gap-2">
          <Switch id="failures-only" checked={failuresOnly} onCheckedChange={setFailuresOnly} />
          <Label htmlFor="failures-only">Failures only</Label>
        </div>
      </div>

      {trail.isSuccess && entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {failuresOnly ? "No failures in this range." : "No calls in this range."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Server</TableHead>
              <TableHead>Call</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead>Outcome</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-muted-foreground tabular-nums">{formatWhen(entry.at)}</TableCell>
                <TableCell className="max-w-40 truncate">{entry.serverName ?? "—"}</TableCell>
                <TableCell className="max-w-96">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="outline">{entry.kind}</Badge>
                    <span className="truncate">{entry.name}</span>
                  </div>
                  {entry.outcome === "error" && entry.error && (
                    <p className="truncate text-xs text-destructive" title={entry.error}>
                      {entry.error}
                    </p>
                  )}
                </TableCell>
                <TableCell className="max-w-40 truncate text-muted-foreground">{entry.client ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatDuration(entry.durationMs)}</TableCell>
                <TableCell>
                  <Outcome outcome={entry.outcome} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {trail.error && (
        <p role="alert" className="text-sm text-destructive">
          {ipcErrorMessage(trail.error)}
        </p>
      )}
      {trail.isFetchingNextPage && <p className="text-center text-xs text-muted-foreground">Loading more…</p>}
      <div ref={end} />
    </section>
  );
}
