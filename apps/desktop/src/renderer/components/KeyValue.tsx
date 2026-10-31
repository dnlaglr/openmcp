import type { ReactNode } from "react";
import { cn } from "cn";

export function KeyValue({ label, children, top = false }: { label: ReactNode; children: ReactNode; top?: boolean }) {
  return (
    <div className={cn("grid min-h-6 grid-cols-[110px_minmax(0,1fr)] gap-3", top ? "items-start" : "items-center")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 wrap-anywhere">{children}</span>
    </div>
  );
}
