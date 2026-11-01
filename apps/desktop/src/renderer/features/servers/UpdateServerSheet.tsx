import { useState, type FormEvent } from "react";

import {
  isStoredSecret,
  launchLabel,
  secretNames,
  type AvailableUpdate,
  type CatalogInput,
  type InstalledServer,
  type ServerState
} from "@openmcp/contracts";

import { initialUpdateValues, updateFormErrors, type InstallFormErrors } from "@/features/catalog/installForm";
import { CatalogInputField } from "@/features/catalog/CatalogInputField";
import { useApplyUpdate } from "@/features/catalog/useCatalog";
import { Sheet, SheetFooter } from "@/components/Sheet";
import { ipcErrorMessage } from "@/lib/ipcError";
import { Callout } from "@/components/Callout";
import { Button } from "@/components/Button";
import { isActive } from "./serverStatus";
import { toast } from "@/lib/toast";

const STORED = "Stored in your keychain. Leave blank to keep.";
const code = "block rounded-md bg-tint-1 px-2 py-1.5 font-mono text-[11.5px] leading-4 wrap-anywhere";
const caption = "text-[11px] font-semibold text-muted-foreground";

type UpdateServerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
  update: AvailableUpdate;
  server: InstalledServer;
  state: ServerState;
};

export function UpdateServerSheet({ open, onOpenChange, onClosed, update, server, state }: UpdateServerSheetProps) {
  const { entry } = update;
  const [values, setValues] = useState(() => initialUpdateValues(entry, server));
  const [errors, setErrors] = useState<InstallFormErrors>({});
  const [shake, setShake] = useState(0);
  const apply = useApplyUpdate();

  function setValue(id: string, value: string) {
    setValues((current) => ({ ...current, [id]: value }));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)));
    if (apply.error) apply.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();

    const next = update.inputsChanged ? updateFormErrors(entry, server, values) : {};
    setErrors(next);
    if (Object.keys(next).length > 0) return setShake((count) => count + 1);

    apply.mutate(
      { id: server.id, version: entry.version, values: update.inputsChanged ? values : undefined },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast(`Updated ${server.name} to v${entry.version}`);
        }
      }
    );
  }

  const field = (input: CatalogInput) => (
    <CatalogInputField
      key={input.id}
      input={isStoredSecret(input, secretNames(server.launch)) ? { ...input, placeholder: STORED } : input}
      value={values[input.id] ?? ""}
      error={errors[input.id]}
      onChange={(value) => setValue(input.id, value)}
    />
  );

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      onClosed={onClosed}
      shake={shake}
      title={`Update “${server.name}”`}
      description={
        <span className="font-mono text-xs">
          v{update.from} → v{entry.version}
        </span>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        {entry.deprecated !== null && (
          <Callout tone="danger" title="This server is deprecated">
            {entry.deprecated && <p>{entry.deprecated}</p>}
          </Callout>
        )}

        {update.inputsChanged ? (
          <>
            <p>This version changes its settings. Check them before updating.</p>
            <div className="flex flex-col gap-3">{entry.inputs.map(field)}</div>
            <p className="text-xs text-muted-foreground">
              {server.launch.type === "http" ? "Your current URL." : "Your current command."} Changes you made to it by
              hand will be replaced.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">Its settings and secrets carry over.</p>
        )}

        <div className="flex flex-col gap-1.5">
          <span className={caption}>Now</span>
          <code className={code}>{launchLabel(server.launch)}</code>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={caption}>After the update</span>
          <code className={code}>{entry.command}</code>
        </div>

        {apply.error && (
          <p role="alert" className="text-xs text-destructive">
            {ipcErrorMessage(apply.error)}
          </p>
        )}

        <SheetFooter>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" busy={apply.isPending} disabled={apply.isPending}>
            {isActive(state) ? "Update and restart" : "Update"}
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  );
}
