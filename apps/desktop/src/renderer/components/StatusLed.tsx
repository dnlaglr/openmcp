import type { ReactNode } from "react";
import { cn } from "cn";

import { useChanged } from "@/hooks/useChanged";

export type LedStatus = "running" | "starting" | "signin" | "error" | "stopped";

type StatusLedProps = { status: LedStatus; label?: ReactNode; className?: string };

export function StatusLed({ status, label, className }: StatusLedProps) {
  const changed = useChanged(status);
  const led = <span aria-hidden className="led" data-status={status} data-changed={changed || undefined} />;
  if (label === undefined) return led;

  return (
    <span className={cn("inline-flex items-center gap-2 text-xs", className)}>
      {led}
      <span key={status} className={cn(changed && "animate-up")}>
        {label}
      </span>
    </span>
  );
}
