import { cn } from "cn";

import { gatewayUrl, type GatewayStatus as Status } from "@openmcp/contracts";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useGatewayState } from "@/features/settings/useGateway";

const dots: Record<Status, string> = {
  starting: "animate-pulse bg-amber-500",
  running: "bg-emerald-500",
  error: "bg-destructive"
};

export function GatewayStatus({ onOpen }: { onOpen: () => void }) {
  const { data: state } = useGatewayState();
  const status = state?.status ?? "starting";

  const label =
    state?.status === "running"
      ? `Gateway on :${state.port}`
      : state?.status === "error"
        ? state.error
        : "Starting gateway";
  const detail = state?.status === "running" ? gatewayUrl(state.port) : label;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onOpen}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-muted-foreground hover:bg-sidebar-accent"
          />
        }
      >
        <span className={cn("mx-1 size-2 shrink-0 rounded-full", dots[status])} />
        <span className="truncate group-data-[collapsible=icon]:hidden">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="right">{detail}</TooltipContent>
    </Tooltip>
  );
}
