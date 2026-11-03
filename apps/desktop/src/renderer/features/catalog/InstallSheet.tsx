import { CircleCheck, TriangleAlert, Check, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { cn } from "cn";

import type { CatalogEntry, CatalogInput } from "@openmcp/contracts";

import { initialInstallForm, installFormErrors, toInstallInput, type InstallFormErrors } from "./installForm";
import { useServerCounts, useServerStates } from "@/features/servers/useServers";
import { installSteps, type StepStatus } from "./installSteps";
import { useInstallServer, useRuntimes } from "./useCatalog";
import { CatalogInputField } from "./CatalogInputField";
import { Sheet, SheetFooter } from "@/components/Sheet";
import { Disclosure } from "@/components/Disclosure";
import type { Navigate } from "@/lib/navigation";
import { ipcErrorMessage } from "@/lib/ipcError";
import { Callout } from "@/components/Callout";
import { Button } from "@/components/Button";
import { Switch } from "@/components/Switch";
import { Field } from "@/components/Field";
import { Input } from "@/components/Input";
import { checkRunner } from "./runtimes";

const caption = "text-[11px] font-semibold text-muted-foreground";
const link = "text-xs font-medium text-primary hover:underline";

const without = (errors: InstallFormErrors, key: string) =>
  Object.fromEntries(Object.entries(errors).filter(([field]) => field !== key));

const icons: Record<StepStatus, string> = {
  wait: "ring-[1.5px] ring-tint-3 ring-inset",
  busy: "ring-2 ring-primary/25 ring-inset",
  done: "animate-pop bg-status-running text-white",
  fail: "animate-pop bg-destructive text-white"
};

function StepIcon({ status }: { status: StepStatus }) {
  return (
    <span className={cn("relative mt-px grid size-5 place-items-center rounded-full", icons[status])}>
      {status === "busy" && (
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
      )}
      {status === "done" && <Check className="size-3" strokeWidth={3} />}
      {status === "fail" && <X className="size-3" strokeWidth={3} />}
    </span>
  );
}

type InstallSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
  entry: CatalogEntry;
  navigate: Navigate;
};

export function InstallSheet({ open, onOpenChange, onClosed, entry, navigate }: InstallSheetProps) {
  const [form, setForm] = useState(() => initialInstallForm(entry));
  const [errors, setErrors] = useState<InstallFormErrors>({});
  const [shake, setShake] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const install = useInstallServer();
  const runtimes = useRuntimes();
  const stateOf = useServerStates();
  const countsOf = useServerCounts();

  const check = checkRunner(entry.runner, runtimes.data);
  const blocked = check !== null && !check.ready;
  const server = install.data;
  const state = server && stateOf(server.id);
  if (state?.error && state.status !== "running" && failure === null) setFailure(state.error);

  const required = entry.inputs.filter((input) => input.required);
  const optional = entry.inputs.filter((input) => !input.required);
  const name = form.name.trim();

  function setValue(id: string, value: string) {
    setForm((current) => ({ ...current, values: { ...current.values, [id]: value } }));
    setErrors((current) => without(current, id));
  }

  function submit(event: FormEvent) {
    event.preventDefault();

    const next = installFormErrors(entry, form);
    setErrors(next);
    if (Object.keys(next).length > 0) setShake((count) => count + 1);
    else install.mutate(toInstallInput(entry, form));
  }

  const field = (input: CatalogInput) => (
    <CatalogInputField
      key={input.id}
      input={input}
      value={form.values[input.id] ?? ""}
      error={errors[input.id]}
      onChange={(value) => setValue(input.id, value)}
    />
  );

  const links = (
    <div className="flex gap-3">
      {entry.repositoryUrl && (
        <a href={entry.repositoryUrl} target="_blank" rel="noreferrer" className={link}>
          Repository
        </a>
      )}
      {entry.websiteUrl && (
        <a href={entry.websiteUrl} target="_blank" rel="noreferrer" className={link}>
          Website
        </a>
      )}
    </div>
  );

  let runtime = null;
  if (check?.ready)
    runtime = (
      <Callout
        tone="ok"
        icon={<CircleCheck />}
        title={`Needs ${check.info.name} · found ${check.version}${check.info.key === "docker" ? ", and it’s running" : ""}`}
      />
    );
  else if (check)
    runtime = (
      <Callout
        tone="warn"
        icon={<TriangleAlert />}
        title={
          check.found ? `${check.info.name} isn’t running.` : `${check.info.name} isn’t installed on this machine.`
        }
        actions={
          <>
            {!check.found && (
              <a href={check.info.url} target="_blank" rel="noreferrer" className={link}>
                How to install {check.info.name}
              </a>
            )}
            <Button size="sm" busy={runtimes.isFetching} onClick={() => void runtimes.refetch()}>
              {runtimes.isFetching ? "Checking…" : "Check again"}
            </Button>
          </>
        }
      >
        <p className="text-xs">
          This server runs with <span className="font-mono">{check.runner}</span>, so it can’t start without it.
        </p>
      </Callout>
    );

  const steps = installSteps({
    name,
    command: entry.command,
    secrets: entry.inputs.some((input) => input.secret && form.values[input.id]?.trim()),
    saved: install.isSuccess,
    status: state?.status,
    pid: state?.pid,
    failure,
    tools: server && state?.status === "running" ? countsOf(server.id)?.tools : undefined
  });
  const running = install.isPending || install.isSuccess;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      onClosed={onClosed}
      title={entry.title}
      description={`${entry.name} · v${entry.version}`}
      shake={shake}
      width={520}
    >
      {running ? (
        <>
          <ol className="flex flex-col py-1">
            {steps.map((step) => (
              <li key={step.title} className="grid min-h-10 animate-up grid-cols-[22px_minmax(0,1fr)] gap-2.5">
                <StepIcon status={step.status} />
                <span className="flex min-w-0 flex-col gap-0.5 pb-3">
                  <b className="font-medium">{step.title}</b>
                  {step.note && <span className="text-xs break-all text-muted-foreground">{step.note}</span>}
                  {step.error && <span className="font-mono text-[11.5px] text-destructive">{step.error}</span>}
                </span>
              </li>
            ))}
          </ol>
          {server && steps[2].status === "done" && (
            <SheetFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
              <Button variant="primary" onClick={() => navigate("servers", { serverId: server.id })}>
                Open in Servers
              </Button>
            </SheetFooter>
          )}
          {server && steps[1].status === "fail" && (
            <SheetFooter>
              <span className="mr-auto text-xs text-muted-foreground">It’s installed, but it couldn’t start.</span>
              <Button onClick={() => navigate("servers", { serverId: server.id, tab: "logs" })}>View logs</Button>
              <Button variant="primary" onClick={() => navigate("servers", { serverId: server.id })}>
                Fix settings
              </Button>
            </SheetFooter>
          )}
        </>
      ) : (
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-col gap-4 overflow-auto">
          <div className="flex flex-col gap-1.5">
            <p className="text-muted-foreground">{entry.description}</p>
            {(entry.repositoryUrl || entry.websiteUrl) && links}
          </div>
          {entry.deprecated !== null && (
            <Callout tone="danger" icon={<TriangleAlert />} title="This server is deprecated">
              {entry.deprecated && <p className="text-xs">{entry.deprecated}</p>}
            </Callout>
          )}
          {runtime}
          <Field
            id="install-name"
            label="Name"
            error={errors.name}
            hint={
              <>
                Agents see its tools as <span className="font-mono">{name || "name"}__tool_name</span>.
              </>
            }
          >
            <Input
              id="install-name"
              value={form.name}
              invalid={!!errors.name}
              onChange={(event) => {
                setForm((current) => ({ ...current, name: event.target.value }));
                setErrors((current) => without(current, "name"));
              }}
            />
          </Field>
          {required.map(field)}
          {optional.length > 0 && (
            <Disclosure title={`Optional settings · ${optional.length}`}>{optional.map(field)}</Disclosure>
          )}
          <label className="flex items-center gap-2.5">
            <Switch
              aria-label="Start when OpenMCP launches"
              checked={form.autostart}
              onCheckedChange={(autostart) => setForm((current) => ({ ...current, autostart }))}
            />
            Start when OpenMCP launches
          </label>
          <div className="flex flex-col gap-1.5">
            <span className={caption}>Runs</span>
            <code className="rounded-[7px] bg-tint-1 px-2.5 py-1.5 font-mono text-[11.5px] leading-[17px] wrap-anywhere ring-1 ring-border ring-inset">
              {entry.command}
            </code>
          </div>
          {install.error && (
            <p role="alert" className="text-xs text-destructive">
              {ipcErrorMessage(install.error)}
            </p>
          )}
          <SheetFooter>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={blocked}>
              {blocked ? `Install (needs ${check.info.name})` : "Install"}
            </Button>
          </SheetFooter>
        </form>
      )}
    </Sheet>
  );
}
