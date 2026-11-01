import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle } from "@base-ui/react/toggle";
import type { ReactNode } from "react";
import { cn } from "cn";

type SegmentedProps<T extends string> = {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  wide?: boolean;
};

export function Segmented<T extends string>({ options, value, onChange, label, wide = false }: SegmentedProps<T>) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      onValueChange={(next) => next[0] && onChange(next[0] as T)}
      className={cn("seg", wide && "grid w-full")}
    >
      <span
        aria-hidden
        className="seg-thumb"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((option) => (
        <Toggle key={option.value} value={option.value} className="seg-item">
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
