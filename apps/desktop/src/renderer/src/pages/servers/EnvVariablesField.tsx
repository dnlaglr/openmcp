import { Plus, Trash2 } from "lucide-react";

import { FieldError, FieldLegend, FieldSet } from "@/components/ui/field";
import { newEnvRow, type EnvRow } from "@/lib/server-form";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

type EnvVariableRowProps = { row: EnvRow; onChange: (patch: Partial<EnvRow>) => void; onRemove: () => void };

type EnvVariablesFieldProps = { rows: EnvRow[]; error?: string; onChange: (rows: EnvRow[]) => void };


function EnvVariableRow({ row, onChange, onRemove }: EnvVariableRowProps) {
  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label="Variable name"
        placeholder="API_KEY"
        className="font-mono"
        value={row.key}
        onChange={(event) => onChange({ key: event.target.value })}
      />
      <Input
        aria-label="Value"
        type={row.secret ? "password" : "text"}
        value={row.value}
        onChange={(event) => onChange({ value: event.target.value })}
      />
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Switch size="sm" aria-label="Secret" checked={row.secret} onCheckedChange={(secret) => onChange({ secret })} />
        Secret
      </label>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove variable" onClick={onRemove}>
        <Trash2 />
      </Button>
    </div>
  );
}


export function EnvVariablesField({ rows, error, onChange }: EnvVariablesFieldProps) {
  const updateRow = (id: string, patch: Partial<EnvRow>) => onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const removeRow = (id: string) => onChange(rows.filter((row) => row.id !== id));

  return (
    <FieldSet data-invalid={!!error}>
      <FieldLegend variant="label">Environment variables</FieldLegend>

      {rows.map((row) => (
        <EnvVariableRow key={row.id} row={row} onChange={(patch) => updateRow(row.id, patch)} onRemove={() => removeRow(row.id)} />
      ))}

      <FieldError>{error}</FieldError>
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange([...rows, newEnvRow()])}>
        <Plus /> Add variable
      </Button>
    </FieldSet>
  );
}
