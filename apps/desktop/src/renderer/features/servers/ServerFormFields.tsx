import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { headerLabels, newHeaderRow, type ServerForm, type ServerFormErrors } from "./serverForm";
import { EnvVariablesField } from "./EnvVariablesField";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

type ServerFormFieldsProps = {
  form: ServerForm;
  errors: ServerFormErrors;
  onChange: (patch: Partial<ServerForm>) => void;
};

export function ServerFormFields({ form, errors, onChange }: ServerFormFieldsProps) {
  return (
    <FieldGroup>
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="server-name">Name</FieldLabel>
        <Input
          id="server-name"
          placeholder="fetch"
          value={form.name}
          aria-invalid={!!errors.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <FieldDescription>Used in the server's local URL. Letters, numbers, - and _.</FieldDescription>
        <FieldError>{errors.name}</FieldError>
      </Field>

      {form.type === "stdio" ? (
        <>
          <Field data-invalid={!!errors.command}>
            <FieldLabel htmlFor="server-command">Command</FieldLabel>
            <Input
              id="server-command"
              placeholder="uvx"
              className="font-mono"
              value={form.command}
              aria-invalid={!!errors.command}
              onChange={(event) => onChange({ command: event.target.value })}
            />
            <FieldError>{errors.command}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="server-args">Arguments</FieldLabel>
            <Textarea
              id="server-args"
              rows={3}
              placeholder="mcp-server-fetch"
              className="font-mono"
              value={form.args}
              onChange={(event) => onChange({ args: event.target.value })}
            />
            <FieldDescription>One per line, so arguments with spaces need no quoting.</FieldDescription>
          </Field>

          <EnvVariablesField
            rows={form.env}
            error={errors.env ?? errors.secrets}
            onChange={(env) => onChange({ env })}
          />
        </>
      ) : (
        <>
          <Field data-invalid={!!errors.url}>
            <FieldLabel htmlFor="server-url">URL</FieldLabel>
            <Input
              id="server-url"
              type="url"
              placeholder="https://example.com/mcp"
              className="font-mono"
              value={form.url}
              aria-invalid={!!errors.url}
              onChange={(event) => onChange({ url: event.target.value })}
            />
            <FieldDescription>The server's Streamable HTTP endpoint.</FieldDescription>
            <FieldError>{errors.url}</FieldError>
          </Field>

          <EnvVariablesField
            labels={headerLabels}
            newRow={newHeaderRow}
            rows={form.headers}
            error={errors.headers ?? errors.secrets}
            onChange={(headers) => onChange({ headers })}
          />
        </>
      )}

      <Field orientation="horizontal">
        <Switch
          id="server-autostart"
          checked={form.autostart}
          onCheckedChange={(autostart) => onChange({ autostart })}
        />
        <FieldLabel htmlFor="server-autostart">Start automatically when OpenMCP launches</FieldLabel>
      </Field>
    </FieldGroup>
  );
}
