import { useState, type FormEvent } from "react";

import {
  commandLine,
  isStoredSecret,
  type AvailableUpdate,
  type CatalogInput,
  type InstalledServer,
  type ServerState
} from "@openmcp/contracts";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { initialUpdateValues, updateFormErrors, type InstallFormErrors } from "./installForm";
import { CatalogInputField } from "./InstallServerDialog";
import { FieldGroup } from "@/components/ui/field";
import { ipcErrorMessage } from "@/lib/ipcError";
import { Button } from "@/components/ui/button";
import { useApplyUpdate } from "./useCatalog";

const STORED = "Stored in your keychain. Leave blank to keep.";
const codeClass = "rounded-xl bg-muted px-3 py-2 font-mono text-xs break-all";

type UpdateServerDialogProps = {
  update: AvailableUpdate;
  server: InstalledServer;
  state: ServerState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UpdateServerDialog({ update, server, state, open, onOpenChange }: UpdateServerDialogProps) {
  const { entry } = update;
  const [values, setValues] = useState(() => initialUpdateValues(entry, server));
  const [errors, setErrors] = useState<InstallFormErrors>({});
  const apply = useApplyUpdate();
  const active = state.status === "starting" || state.status === "running";

  function changeOpen(next: boolean) {
    onOpenChange(next);
    if (next) return;

    setValues(initialUpdateValues(entry, server));
    setErrors({});
    apply.reset();
  }

  function setValue(id: string, value: string) {
    setValues((current) => ({ ...current, [id]: value }));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)));
    if (apply.error) apply.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();

    const next = update.inputsChanged ? updateFormErrors(entry, server, values) : {};
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    apply.mutate(
      { id: server.id, version: entry.version, values: update.inputsChanged ? values : undefined },
      { onSuccess: () => changeOpen(false) }
    );
  }

  const inputField = (input: CatalogInput) => (
    <CatalogInputField
      key={input.id}
      input={isStoredSecret(input, server.launch.secretEnv) ? { ...input, placeholder: STORED } : input}
      value={values[input.id] ?? ""}
      error={errors[input.id]}
      onChange={(value) => setValue(input.id, value)}
    />
  );

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Update '{server.name}'</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              v{update.from} → v{entry.version}
            </DialogDescription>
          </DialogHeader>

          {entry.deprecated !== null && (
            <p role="alert" className="rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              This server is deprecated.{entry.deprecated && ` ${entry.deprecated}`}
            </p>
          )}

          {update.inputsChanged && (
            <>
              <p className="text-sm">This version changes its settings. Check them before updating.</p>
              <FieldGroup>{entry.inputs.map(inputField)}</FieldGroup>
              <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                <p>Your current command. Changes you made to it by hand will be replaced.</p>
                <code className={codeClass}>{commandLine(server.launch)}</code>
              </div>
            </>
          )}

          <code className={codeClass}>{entry.command}</code>

          {apply.error && (
            <p role="alert" className="text-sm text-destructive">
              {ipcErrorMessage(apply.error)}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={apply.isPending}>
              {active ? "Update and restart" : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
