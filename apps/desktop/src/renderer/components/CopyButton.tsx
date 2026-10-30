import { useState, type ComponentProps } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

type CopyButtonProps = { label: string; value: string } & Pick<ComponentProps<typeof Button>, "variant" | "size">;

export function CopyButton({ label, value, variant = "outline", size = "icon" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button variant={variant} size={size} aria-label={label} disabled={!value} onClick={() => void copy()}>
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}
