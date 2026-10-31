import type { ComponentProps } from "react";
import { cn } from "cn";

type Look = { mono?: boolean; invalid?: boolean; flash?: boolean };

const look = ({ mono, invalid, flash }: Look) => ({
  "aria-invalid": invalid || undefined,
  "data-flash": flash || undefined,
  className: cn("field-inset w-full px-2.5 text-[13px]", mono && "font-mono text-xs")
});

export function Input({ mono, invalid, flash, className, ...props }: ComponentProps<"input"> & Look) {
  const base = look({ mono, invalid, flash });
  return <input {...base} className={cn(base.className, "h-7", className)} {...props} />;
}

export function Textarea({ mono, invalid, flash, className, ...props }: ComponentProps<"textarea"> & Look) {
  const base = look({ mono, invalid, flash });
  return (
    <textarea {...base} className={cn(base.className, "resize-none py-1.5 leading-[18px]", className)} {...props} />
  );
}
