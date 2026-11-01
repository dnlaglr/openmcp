import type { ComponentProps } from "react";
import { Search } from "lucide-react";
import { cn } from "cn";

import { Input } from "./Input";

export function SearchField({ className, ...props }: ComponentProps<"input">) {
  return (
    <span className={cn("relative block", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input className="pl-8" {...props} />
    </span>
  );
}
