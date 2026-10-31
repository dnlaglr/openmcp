import type { ReactNode } from "react";
import { cn } from "cn";

type FieldProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
};

export function Field({ id, label, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="animate-up text-[11.5px] leading-[15px] text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-[11.5px] leading-[15px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
