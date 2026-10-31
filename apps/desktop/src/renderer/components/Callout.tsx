import type { ReactNode } from "react";
import { cn } from "cn";

const tones = {
  neutral: "bg-tint-1 ring-border",
  accent: "bg-primary/6 ring-primary/22 [&_.callout-icon]:text-primary",
  warn: "bg-status-attention/10 ring-status-attention/35 [&_.callout-icon]:text-warn-ink",
  danger: "bg-destructive/7 ring-destructive/25 [&_.callout-icon]:text-destructive",
  ok: "bg-status-running/7 ring-status-running/30 [&_.callout-icon]:text-ok-ink"
};

type CalloutProps = {
  tone?: keyof typeof tones;
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
};

export function Callout({ tone = "neutral", icon, title, children, actions }: CalloutProps) {
  return (
    <div className={cn("flex animate-up flex-col gap-2 rounded-[9px] px-3.5 py-3 ring-1 ring-inset", tones[tone])}>
      <div className="flex items-center gap-2">
        {icon && <span className="callout-icon flex [&_svg]:size-4">{icon}</span>}
        <b className="font-semibold">{title}</b>
      </div>
      {children}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
