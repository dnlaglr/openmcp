import type { ReactNode } from "react";
import { cn } from "cn";

const tones = {
  neutral: "bg-tint-2 text-muted-foreground",
  accent: "bg-accent text-accent-foreground",
  warn: "bg-status-attention/20 text-warn-ink",
  danger: "bg-destructive/12 text-destructive"
};

type TagProps = { tone?: keyof typeof tones; mono?: boolean; children: ReactNode; className?: string };

export function Tag({ tone = "neutral", mono = false, children, className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center rounded px-1.5 text-[11px] font-medium whitespace-nowrap",
        mono && "font-mono",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
