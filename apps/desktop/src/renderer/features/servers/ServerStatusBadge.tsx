import { cn } from "cn";

import type { ServerState, ServerStatus } from "@openmcp/contracts";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

const appearance: Record<ServerStatus, { label: string; dot: string }> = {
  stopped: { label: "Stopped", dot: "bg-muted-foreground" },
  starting: { label: "Starting", dot: "animate-pulse bg-amber-500" },
  running: { label: "Running", dot: "bg-emerald-500" },
  error: { label: "Error", dot: "bg-destructive" }
};

// A remote server has no process to start, so while it (re)connects it says so.
export function ServerStatusBadge({ state, remote = false }: { state: ServerState; remote?: boolean }) {
  const { dot } = appearance[state.status];
  const label = remote && state.status === "starting" ? "Connecting" : appearance[state.status].label;
  const badge = (
    <Badge variant={state.status === "error" ? "destructive" : "outline"}>
      <span className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </Badge>
  );

  if (!state.error) return badge;

  return (
    <Tooltip>
      <TooltipTrigger render={badge} />
      <TooltipContent>{state.error}</TooltipContent>
    </Tooltip>
  );
}
