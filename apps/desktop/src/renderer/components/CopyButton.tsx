import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";

import { IconButton } from "./IconButton";

type CopyButtonProps = { label: string; value: string; onCopied?: () => void };

export function CopyButton({ label, value, onCopied }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    onCopied?.();
    setTimeout(() => setCopied(false), 1500);
  }

  const icon = "absolute inset-0 transition-[opacity,transform] duration-(--d3) ease-(--spring)";
  return (
    <IconButton label={label} disabled={!value} onClick={() => void copy()}>
      <span className="relative block size-3.5">
        <Copy className={cn(icon, copied && "scale-50 opacity-0")} />
        <Check className={cn(icon, "text-status-running", !copied && "scale-50 opacity-0")} />
      </span>
    </IconButton>
  );
}
