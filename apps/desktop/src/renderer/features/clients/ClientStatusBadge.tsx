import { cn } from "cn";

import type { ClientState, ClientStatus } from "@openmcp/contracts";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

const appearance: Record<ClientStatus, { label: string; dot: string }> = {
  missing: { label: "Not found", dot: "bg-muted-foreground/40" },
  disconnected: { label: "Not connected", dot: "bg-muted-foreground" },
  connected: { label: "Connected", dot: "bg-emerald-500" },
  outdated: { label: "Out of date", dot: "bg-amber-500" },
  error: { label: "Error", dot: "bg-destructive" }
};

export function ClientStatusBadge({ client }: { client: ClientState }) {
  const { label, dot } = appearance[client.status];
  const badge = (
    <Badge variant={client.status === "error" ? "destructive" : "outline"}>
      <span className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </Badge>
  );

  if (!client.error) return badge;

  return (
    <Tooltip>
      <TooltipTrigger render={badge} />
      <TooltipContent>{client.error}</TooltipContent>
    </Tooltip>
  );
}
