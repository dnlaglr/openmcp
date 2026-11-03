import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { cn } from "cn";

import { TOOL_CALL_STOPPED, type Tool, type ToolRun } from "@openmcp/contracts";

import { formValues, parseArguments, toolArguments, type Field as ToolField } from "./serverDetails";
import { formatDuration } from "@/features/activity/activityFormat";
import { Input, Textarea } from "@/components/Input";
import { CopyButton } from "@/components/CopyButton";
import { ipcErrorMessage } from "@/lib/ipcError";
import { AlertSheet } from "@/components/Sheet";
import { Callout } from "@/components/Callout";
import { Switch } from "@/components/Switch";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Tag } from "@/components/Tag";
import { toast } from "@/lib/toast";

type Args = Record<string, unknown>;
type Block = ToolRun["result"]["content"][number];

type ToolRunnerProps = { serverId: string; serverName: string; tool: Tool; fields: ToolField[]; onClose: () => void };

const pre = "max-h-72 overflow-auto font-mono text-xs break-words whitespace-pre-wrap";

const elideBase64 = (key: string, value: unknown) =>
  (key === "data" || key === "blob") && typeof value === "string" ? `(${value.length} base64 characters)` : value;

export function ToolRunner({ serverId, serverName, tool, fields, onClose }: ToolRunnerProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [raw, setRaw] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Args | null>(null);
  const rawId = useId();

  // A server that stops mid-call leaves the Tools tab, so the message has to outlive this form.
  const call = useMutation({
    mutationFn: ({ args, callId }: { args: Args; callId: string }) =>
      window.api.invoke("servers:callTool", { id: serverId, name: tool.name, arguments: args, callId }),
    onError: (error) => {
      if (ipcErrorMessage(error) === TOOL_CALL_STOPPED) toast(`${serverName} stopped before ${tool.name} finished`);
    }
  });

  const start = (args: Args) => call.mutate({ args, callId: crypto.randomUUID() });

  function cancel() {
    if (call.variables) void window.api.invoke("servers:cancelToolCall", { callId: call.variables.callId });
    call.reset();
  }

  function collect() {
    if (raw === null) {
      const { arguments: args, errors } = toolArguments(fields, values);
      setErrors(errors);
      return Object.keys(errors).length ? null : args;
    }

    const args = parseArguments(raw);
    setRawError(args ? null : "Enter a JSON object.");
    return args;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const args = collect();
    if (!args) return;

    if (tool.annotations?.destructiveHint) setConfirming(args);
    else start(args);
  }

  function toggleRaw(on: boolean) {
    if (on) {
      setRaw(JSON.stringify(toolArguments(fields, values).arguments, null, 2));
      setRawError(null);
      return;
    }

    const args = parseArguments(raw ?? "");
    if (!args) return setRawError("Fix the JSON to go back to the form.");

    setValues(formValues(fields, args));
    setErrors({});
    setRaw(null);
  }

  return (
    <>
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-semibold text-muted-foreground">Arguments</h4>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Raw JSON
            <Switch size="sm" aria-label="Raw JSON" checked={raw !== null} onCheckedChange={toggleRaw} />
          </label>
        </div>

        {raw === null ? (
          fields.map((field) => (
            <ArgumentField
              key={field.name}
              field={field}
              value={values[field.name] ?? ""}
              error={errors[field.name]}
              onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
            />
          ))
        ) : (
          <Field id={rawId} label="Arguments as JSON" error={rawError}>
            <Textarea
              id={rawId}
              mono
              rows={Math.min(12, Math.max(4, raw.split("\n").length))}
              value={raw}
              invalid={!!rawError}
              onChange={(event) => setRaw(event.target.value)}
            />
          </Field>
        )}
        {raw === null && fields.length === 0 && <p className="text-xs text-muted-foreground">Takes no parameters.</p>}

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            size="sm"
            variant="primary"
            busy={call.isPending}
            disabled={call.isPending}
            aria-label={`Run ${tool.name}`}
          >
            {!call.isPending && <Play />}
            Run
          </Button>
          {call.isPending ? (
            <Button size="sm" onClick={cancel}>
              Cancel
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </form>

      {call.error && (
        <Callout tone="danger" title={`Couldn’t run ${tool.name}`}>
          <p>{ipcErrorMessage(call.error)}</p>
        </Callout>
      )}
      {call.data && <ToolResult name={tool.name} run={call.data} />}

      <AlertSheet
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Run ${tool.name}?`}
        description={`${serverName} marks this tool as destructive, so it may change or delete data.`}
        confirmLabel="Run"
        onConfirm={() => {
          if (confirming) start(confirming);
          setConfirming(null);
        }}
      />
    </>
  );
}

type ArgumentFieldProps = { field: ToolField; value: string; error?: string; onChange: (value: string) => void };

function ArgumentField({ field, value, error, onChange }: ArgumentFieldProps) {
  const id = useId();
  const label = (
    <>
      <span className="font-mono">{field.name}</span>
      <span aria-hidden className="font-mono font-normal text-muted-foreground">
        {" "}
        · {field.type}
        {field.required && " · required"}
      </span>
    </>
  );

  if (field.input === "boolean") {
    return (
      <label className="flex items-center gap-2.5 text-xs">
        <Switch aria-label={field.name} checked={value === "true"} onCheckedChange={(on) => onChange(String(on))} />
        <span>
          {label}
          {field.description && <span className="text-muted-foreground"> · {field.description}</span>}
        </span>
      </label>
    );
  }

  const common = { id, value, "aria-required": field.required, "aria-invalid": !!error || undefined };
  let control: ReactNode;
  if (field.input === "enum") {
    control = (
      <select
        {...common}
        className="field-inset h-7 px-2 text-[13px]"
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{field.required ? "Choose…" : "Not set"}</option>
        {field.choices?.map((choice) => (
          <option key={String(choice)} value={String(choice)}>
            {String(choice)}
          </option>
        ))}
      </select>
    );
  } else if (field.input === "json") {
    control = (
      <Textarea {...common} mono rows={3} placeholder="JSON" onChange={(event) => onChange(event.target.value)} />
    );
  } else {
    const number = field.input === "number" || field.input === "integer";
    control = (
      <Input
        {...common}
        type={number ? "number" : "text"}
        step={field.input === "integer" ? 1 : "any"}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <Field id={id} label={label} hint={field.description} error={error}>
      {control}
    </Field>
  );
}

function ToolResult({ name, run: { result, durationMs } }: { name: string; run: ToolRun }) {
  const failed = result.isError === true;

  return (
    <section
      aria-label={`${name} ${failed ? "error" : "result"}`}
      className={cn(
        "flex animate-up flex-col gap-2.5 rounded-[9px] px-3 py-2.5 ring-1 ring-inset",
        failed ? "bg-destructive/7 ring-destructive/25" : "bg-tint-1 ring-border"
      )}
    >
      <div className="flex items-center gap-2">
        <Tag tone={failed ? "danger" : "ok"}>{failed ? "Error" : "OK"}</Tag>
        <span className="flex-1 text-xs text-muted-foreground tabular-nums">{formatDuration(durationMs)}</span>
        <CopyButton
          label="Copy result as JSON"
          value={JSON.stringify(result, null, 2)}
          onCopied={() => toast("Copied the result")}
        />
      </div>
      {result.content.map((block, index) => (
        <ContentBlock key={index} block={block} />
      ))}
      {result.content.length === 0 && <p className="text-xs text-muted-foreground italic">No content.</p>}
      {result.structuredContent !== undefined && (
        <div className="flex flex-col gap-1">
          <h4 className="text-[11px] font-semibold text-muted-foreground">Structured content</h4>
          <pre className={pre}>{JSON.stringify(result.structuredContent, null, 2)}</pre>
        </div>
      )}
    </section>
  );
}

function ContentBlock({ block }: { block: Block }) {
  if (block.type === "text") return <pre className={pre}>{block.text}</pre>;
  if (block.type === "image") {
    return (
      <img
        alt={`Image (${block.mimeType})`}
        src={`data:${block.mimeType};base64,${block.data}`}
        className="max-h-64 max-w-full self-start rounded-md"
      />
    );
  }
  if (block.type === "resource" && "text" in block.resource) {
    return (
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[11px] break-all text-muted-foreground">{block.resource.uri}</span>
        <pre className={pre}>{block.resource.text}</pre>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{block.type}</span>
      <pre className={pre}>{JSON.stringify(block, elideBase64, 2)}</pre>
    </div>
  );
}
