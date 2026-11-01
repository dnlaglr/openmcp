import { Lock, X } from "lucide-react";
import { cn } from "cn";

import { envLabels, newEnvRow, type EnvRow, type VariableLabels } from "./serverForm";
import { IconButton } from "@/components/IconButton";
import { Tooltip } from "@/components/Tooltip";
import { Input } from "@/components/Input";

type VariableRowsProps = {
  rows: EnvRow[];
  error?: string;
  labels?: VariableLabels;
  newRow?: () => EnvRow;
  flash?: boolean;
  onChange: (rows: EnvRow[]) => void;
};

function placeholder(row: EnvRow) {
  if (!row.secret) return "Value";
  return row.stored !== null ? "Kept in keychain · type to replace" : "Secret value";
}

export function VariableRows({
  rows,
  error,
  labels = envLabels,
  newRow = newEnvRow,
  flash = false,
  onChange
}: VariableRowsProps) {
  const update = (id: string, patch: Partial<EnvRow>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  return (
    <div role="group" aria-label={labels.legend} className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{labels.legend}</span>
        <button
          type="button"
          aria-label={labels.add}
          onClick={() => onChange([...rows, newRow()])}
          className="text-xs font-medium text-primary hover:underline"
        >
          + Add
        </button>
      </div>

      {rows.map((row) => (
        <div key={row.id} className="grid animate-up grid-cols-[150px_minmax(0,1fr)_26px_26px] items-center gap-1.5">
          <Input
            mono
            aria-label={labels.name}
            placeholder={labels.placeholder}
            value={row.key}
            flash={flash}
            onChange={(event) => update(row.id, { key: event.target.value })}
          />
          <Input
            aria-label="Value"
            type={row.secret ? "password" : "text"}
            placeholder={placeholder(row)}
            value={row.value}
            flash={flash}
            onChange={(event) => update(row.id, { value: event.target.value })}
          />
          <Tooltip label="Keep in the keychain">
            <button
              type="button"
              aria-label="Keep in the keychain"
              aria-pressed={row.secret}
              onClick={() => update(row.id, { secret: !row.secret })}
              className={cn(
                "grid size-[26px] place-items-center rounded-md text-muted-foreground outline-none transition-colors duration-(--d2) hover:bg-tint-2 focus-visible:focus-halo",
                row.secret && "bg-primary/10 text-primary"
              )}
            >
              <Lock className="size-3.5" />
            </button>
          </Tooltip>
          <IconButton label={labels.remove} onClick={() => onChange(rows.filter((other) => other.id !== row.id))}>
            <X />
          </IconButton>
        </div>
      ))}

      {rows.length === 0 && (
        <p className="text-[11.5px] text-muted-foreground">None. The lock keeps a value in your OS keychain.</p>
      )}
      {error && (
        <p role="alert" className="animate-up text-[11.5px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
