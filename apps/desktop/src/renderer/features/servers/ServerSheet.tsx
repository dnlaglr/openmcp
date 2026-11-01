import { useState, type FormEvent } from "react";

import type { InstalledServer } from "@openmcp/contracts";

import {
  emptyServerForm,
  headerLabels,
  keptSecrets,
  newHeaderRow,
  serverFormFrom,
  type ServerForm
} from "./serverForm";
import { useAddCustomServer, useUpdateServer } from "./useServers";
import { Sheet, SheetFooter } from "@/components/Sheet";
import { Input, Textarea } from "@/components/Input";
import { PasteConfigForm } from "./PasteConfigForm";
import { Segmented } from "@/components/Segmented";
import { ipcErrorMessage } from "@/lib/ipcError";
import { useServerForm } from "./useServerForm";
import { VariableRows } from "./VariableRows";
import { Button } from "@/components/Button";
import { Switch } from "@/components/Switch";
import { Field } from "@/components/Field";
import { toast } from "@/lib/toast";

type ServerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
  server?: InstalledServer;
  remote?: boolean;
  running?: boolean;
  onAdded?: (server: InstalledServer) => void;
};

const kinds = [
  { value: "stdio" as const, label: "Local command" },
  { value: "http" as const, label: "Remote URL" }
];

export function ServerSheet({
  open,
  onOpenChange,
  onClosed,
  server,
  remote = false,
  running = false,
  onAdded
}: ServerSheetProps) {
  const serverForm = useServerForm(
    server ? serverFormFrom(server) : { ...emptyServerForm, type: remote ? "http" : "stdio" }
  );
  const add = useAddCustomServer();
  const update = useUpdateServer();
  const [shake, setShake] = useState(0);
  const [pasting, setPasting] = useState(false);
  const [flash, setFlash] = useState(false);
  const { form, errors } = serverForm;
  const failure = add.error ?? update.error;

  function change(patch: Partial<ServerForm>) {
    serverForm.update(patch);
    add.reset();
    update.reset();
  }

  function fill(patch: Partial<ServerForm>, skipped: number) {
    change(patch);
    setPasting(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 900);
    if (skipped > 0) toast(`Used the first of ${skipped + 1} servers in the snippet`);
  }

  function submit(event: FormEvent) {
    event.preventDefault();

    const fields = serverForm.validate();
    if (!fields) return setShake((count) => count + 1);

    if (server) {
      update.mutate(
        { id: server.id, ...fields, keepSecrets: keptSecrets(form) },
        {
          onSuccess: () => {
            onOpenChange(false);
            toast(running ? `Saved ${fields.name} · restarting` : `Saved ${fields.name}`);
          }
        }
      );
    } else {
      add.mutate(fields, {
        onSuccess: (added) => {
          onOpenChange(false);
          onAdded?.(added);
        }
      });
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      onClosed={onClosed}
      shake={shake}
      title={server ? `Edit “${server.name}”` : "Add a server"}
      description={
        server
          ? "Secrets stay in your keychain and aren’t shown. Leave one blank to keep it."
          : "Run a program on this machine, or connect to a remote server."
      }
      aside={
        !server && (
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setPasting(!pasting)}
          >
            Paste a config…
          </button>
        )
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        {pasting && <PasteConfigForm onFill={fill} onCancel={() => setPasting(false)} />}
        {!server && (
          <Segmented label="Server type" wide options={kinds} value={form.type} onChange={(type) => change({ type })} />
        )}

        <Field
          id="server-name"
          label="Name"
          error={errors.name}
          hint={
            <>
              Agents see its tools as <span className="font-mono">{form.name.trim() || "name"}__tool_name</span>.
            </>
          }
        >
          <Input
            id="server-name"
            placeholder="memory"
            value={form.name}
            invalid={!!errors.name}
            flash={flash}
            onChange={(event) => change({ name: event.target.value })}
          />
        </Field>

        {form.type === "stdio" ? (
          <>
            <Field id="server-command" label="Command" error={errors.command}>
              <Input
                id="server-command"
                mono
                placeholder="npx"
                value={form.command}
                invalid={!!errors.command}
                flash={flash}
                onChange={(event) => change({ command: event.target.value })}
              />
            </Field>
            <Field id="server-args" label="Arguments" hint="One per line, so arguments with spaces need no quotes.">
              <Textarea
                id="server-args"
                mono
                rows={3}
                placeholder="-y"
                value={form.args}
                flash={flash}
                onChange={(event) => change({ args: event.target.value })}
              />
            </Field>
            <VariableRows
              rows={form.env}
              error={errors.env ?? errors.secrets}
              flash={flash}
              onChange={(env) => change({ env })}
            />
          </>
        ) : (
          <>
            <Field
              id="server-url"
              label="URL"
              error={errors.url}
              hint="Servers that need an account ask you to sign in after you add them."
            >
              <Input
                id="server-url"
                type="url"
                mono
                placeholder="https://example.com/mcp"
                value={form.url}
                invalid={!!errors.url}
                flash={flash}
                onChange={(event) => change({ url: event.target.value })}
              />
            </Field>
            <VariableRows
              labels={headerLabels}
              newRow={newHeaderRow}
              rows={form.headers}
              error={errors.headers ?? errors.secrets}
              flash={flash}
              onChange={(headers) => change({ headers })}
            />
          </>
        )}

        <label className="flex items-center gap-2.5">
          <Switch
            aria-label="Start when OpenMCP launches"
            checked={form.autostart}
            onCheckedChange={(autostart) => change({ autostart })}
          />
          Start when OpenMCP launches
        </label>

        {failure && (
          <p role="alert" className="text-xs text-destructive">
            {ipcErrorMessage(failure)}
          </p>
        )}

        <SheetFooter>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            busy={add.isPending || update.isPending}
            disabled={add.isPending || update.isPending}
          >
            {server ? (running ? "Save and restart" : "Save") : "Add server"}
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  );
}
