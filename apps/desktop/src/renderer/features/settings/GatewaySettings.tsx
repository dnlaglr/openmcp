import { useState, type FormEvent } from "react";
import { Check, Copy } from "lucide-react";

import { GatewayPort } from "@openmcp/contracts";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet
} from "@/components/ui/field";
import { useGatewayConnection, useGatewayState, useRegenerateGatewayToken, useSetGatewayPort } from "./useGateway";
import { ipcErrorMessage } from "@/lib/ipcError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button variant="outline" size="icon" aria-label={label} disabled={!value} onClick={() => void copy()}>
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

function RegenerateTokenButton() {
  const regenerate = useRegenerateGatewayToken();
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        regenerate.reset();
      }}
    >
      <AlertDialogTrigger render={<Button variant="outline" />}>Regenerate</AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Regenerate the gateway token?</AlertDialogTitle>
          <AlertDialogDescription>
            Agents using the current token lose access until you give them the new one.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {regenerate.error && (
          <p role="alert" className="text-sm text-destructive">
            {ipcErrorMessage(regenerate.error)}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={regenerate.isPending}
            onClick={() => regenerate.mutate(undefined, { onSuccess: () => setOpen(false) })}
          >
            Regenerate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function GatewaySettings() {
  const { data: state } = useGatewayState();
  const { data: connection, error } = useGatewayConnection();
  const setPort = useSetGatewayPort();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);

  const port = draft ?? String(state?.port ?? "");
  const portError =
    invalid ??
    (setPort.error ? ipcErrorMessage(setPort.error) : null) ??
    (state?.status === "error" ? state.error : null);

  function save(event: FormEvent) {
    event.preventDefault();

    const parsed = GatewayPort.safeParse(Number(port));
    if (!parsed.success) {
      setInvalid(parsed.error.issues[0].message);
      return;
    }

    setInvalid(null);
    setPort.mutate(parsed.data, { onSuccess: () => setDraft(null) });
  }

  return (
    <FieldSet>
      <FieldLegend>Gateway</FieldLegend>
      <FieldDescription>
        Agents connect to this address and send the token in an Authorization: Bearer header.
      </FieldDescription>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {ipcErrorMessage(error)}
        </p>
      )}

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="gateway-url">URL</FieldLabel>
          <div className="flex gap-2">
            <Input id="gateway-url" readOnly className="font-mono" value={connection?.url ?? ""} />
            <CopyButton label="Copy URL" value={connection?.url ?? ""} />
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="gateway-token">Token</FieldLabel>
          <div className="flex gap-2">
            <Input id="gateway-token" type="password" readOnly className="font-mono" value={connection?.token ?? ""} />
            <CopyButton label="Copy token" value={connection?.token ?? ""} />
            <RegenerateTokenButton />
          </div>
        </Field>

        <form onSubmit={save}>
          <Field data-invalid={!!portError}>
            <FieldLabel htmlFor="gateway-port">Port</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="gateway-port"
                inputMode="numeric"
                className="w-32 font-mono"
                value={port}
                aria-invalid={!!portError}
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button type="submit" variant="outline" disabled={setPort.isPending}>
                Save port
              </Button>
            </div>
            <FieldDescription>Agents set up with the old port need the new URL.</FieldDescription>
            <FieldError>{portError}</FieldError>
          </Field>
        </form>
      </FieldGroup>
    </FieldSet>
  );
}
