import { useState, type FormEvent } from "react";

import type { CatalogEntry, CatalogInput, CatalogRunner } from "@openmcp/contracts";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { initialInstallForm, installFormErrors, toInstallInput, type InstallFormErrors } from "./installForm";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ipcErrorMessage } from "@/lib/ipcError";
import { useInstallServer } from "./useCatalog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

const runnerNotes: Record<CatalogRunner, { label: string; url: string }> = {
  npx: { label: "Needs Node.js", url: "https://nodejs.org/en/download" },
  uvx: { label: "Needs uv", url: "https://docs.astral.sh/uv/getting-started/installation/" },
  docker: { label: "Needs Docker", url: "https://docs.docker.com/get-started/get-docker/" }
};

const linkClass = "underline-offset-4 hover:underline";

type CatalogInputFieldProps = { input: CatalogInput; value: string; error?: string; onChange: (value: string) => void };

export function CatalogInputField({ input, value, error, onChange }: CatalogInputFieldProps) {
  const id = `install-${input.id}`;
  const description = input.description && <FieldDescription>{input.description}</FieldDescription>;

  if (input.kind === "flag") {
    return (
      <Field orientation="horizontal">
        <Switch id={id} checked={value === "true"} onCheckedChange={(checked) => onChange(checked ? "true" : "")} />
        <FieldContent>
          <FieldLabel htmlFor={id} className="font-mono">
            {input.label}
          </FieldLabel>
          {description}
        </FieldContent>
      </Field>
    );
  }

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id} className="font-mono">
        {input.label}
      </FieldLabel>
      {input.choices ? (
        <NativeSelect
          id={id}
          className="w-full"
          value={value}
          aria-invalid={!!error}
          onChange={(event) => onChange(event.target.value)}
        >
          <NativeSelectOption value="">{input.required ? "Choose…" : "Not set"}</NativeSelectOption>
          {input.choices.map((choice) => (
            <NativeSelectOption key={choice} value={choice}>
              {choice}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : (
        <Input
          id={id}
          type={input.secret ? "password" : "text"}
          placeholder={input.placeholder ?? undefined}
          value={value}
          aria-invalid={!!error}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {description}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

type InstallServerDialogProps = { entry: CatalogEntry; open: boolean; onOpenChange: (open: boolean) => void };

export function InstallServerDialog({ entry, open, onOpenChange }: InstallServerDialogProps) {
  const [form, setForm] = useState(() => initialInstallForm(entry));
  const [errors, setErrors] = useState<InstallFormErrors>({});
  const install = useInstallServer();
  const required = entry.inputs.filter((input) => input.required);
  const optional = entry.inputs.filter((input) => !input.required);
  const note = runnerNotes[entry.runner];

  function changeOpen(next: boolean) {
    onOpenChange(next);
    if (next) return;

    setForm(initialInstallForm(entry));
    setErrors({});
    install.reset();
  }

  function clearError(field: string) {
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== field)));
    if (install.error) install.reset();
  }

  function setName(name: string) {
    setForm((current) => ({ ...current, name }));
    clearError("name");
  }

  function setValue(id: string, value: string) {
    setForm((current) => ({ ...current, values: { ...current.values, [id]: value } }));
    clearError(id);
  }

  function submit(event: FormEvent) {
    event.preventDefault();

    const next = installFormErrors(entry, form);
    setErrors(next);
    if (Object.keys(next).length === 0) {
      install.mutate(toInstallInput(entry, form), { onSuccess: () => changeOpen(false) });
    }
  }

  const inputField = (input: CatalogInput) => (
    <CatalogInputField
      key={input.id}
      input={input}
      value={form.values[input.id] ?? ""}
      error={errors[input.id]}
      onChange={(value) => setValue(input.id, value)}
    />
  );

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{entry.title}</DialogTitle>
            <p className="font-mono text-xs text-muted-foreground">
              {entry.name} · v{entry.version}
            </p>
            <DialogDescription>{entry.description}</DialogDescription>
            {(entry.repositoryUrl || entry.websiteUrl) && (
              <div className="flex gap-3 text-sm">
                {entry.repositoryUrl && (
                  <a href={entry.repositoryUrl} target="_blank" rel="noreferrer" className={linkClass}>
                    Repository
                  </a>
                )}
                {entry.websiteUrl && (
                  <a href={entry.websiteUrl} target="_blank" rel="noreferrer" className={linkClass}>
                    Website
                  </a>
                )}
              </div>
            )}
          </DialogHeader>

          {entry.deprecated !== null && (
            <p role="alert" className="rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              This server is deprecated.{entry.deprecated && ` ${entry.deprecated}`}
            </p>
          )}

          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="install-name">Name</FieldLabel>
              <Input
                id="install-name"
                value={form.name}
                aria-invalid={!!errors.name}
                onChange={(event) => setName(event.target.value)}
              />
              <FieldDescription>Prefixes this server's tools for agents. Letters, numbers, - and _.</FieldDescription>
              <FieldError>{errors.name}</FieldError>
            </Field>

            {required.map(inputField)}

            {optional.length > 0 && (
              <details>
                <summary className="cursor-pointer text-sm font-medium">Optional settings ({optional.length})</summary>
                <FieldGroup className="pt-4">{optional.map(inputField)}</FieldGroup>
              </details>
            )}

            <Field orientation="horizontal">
              <Switch
                id="install-autostart"
                checked={form.autostart}
                onCheckedChange={(autostart) => setForm((current) => ({ ...current, autostart }))}
              />
              <FieldLabel htmlFor="install-autostart">Start automatically when OpenMCP launches</FieldLabel>
            </Field>
          </FieldGroup>

          <div className="flex flex-col gap-1.5 text-xs">
            <code className="rounded-xl bg-muted px-3 py-2 font-mono break-all">{entry.command}</code>
            <a
              href={note.url}
              target="_blank"
              rel="noreferrer"
              className={`self-start text-muted-foreground ${linkClass}`}
            >
              {note.label}
            </a>
          </div>

          {install.error && (
            <p role="alert" className="text-sm text-destructive">
              {ipcErrorMessage(install.error)}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={install.isPending}>
              Install
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
