import type { CatalogInput } from "@openmcp/contracts";

import { Switch } from "@/components/Switch";
import { Input } from "@/components/Input";
import { Field } from "@/components/Field";

type CatalogInputFieldProps = { input: CatalogInput; value: string; error?: string; onChange: (value: string) => void };

export function CatalogInputField({ input, value, error, onChange }: CatalogInputFieldProps) {
  const id = `install-${input.id}`;

  if (input.kind === "flag") {
    return (
      <label className="flex items-center gap-2.5">
        <Switch
          aria-label={input.label}
          checked={value === "true"}
          onCheckedChange={(checked) => onChange(checked ? "true" : "")}
        />
        <span>
          <span className="font-mono text-xs">{input.label}</span>
          {input.description && <span className="text-xs text-muted-foreground"> · {input.description}</span>}
        </span>
      </label>
    );
  }

  const label = (
    <>
      <span className="font-mono">{input.label}</span>
      {input.secret && <span className="font-normal text-muted-foreground"> · kept in your keychain</span>}
    </>
  );

  return (
    <Field id={id} label={label} hint={input.description} error={error}>
      {input.choices ? (
        <select
          id={id}
          className="field-inset h-7 px-2 text-[13px]"
          value={value}
          aria-invalid={!!error || undefined}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{input.required ? "Choose…" : "Not set"}</option>
          {input.choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={id}
          mono={input.secret}
          type={input.secret ? "password" : "text"}
          placeholder={input.placeholder ?? undefined}
          value={value}
          invalid={!!error}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}
