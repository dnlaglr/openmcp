import { ArrowDownToLine } from "lucide-react";
import { useId, useState } from "react";

import type { ClientState, ImportEntry } from "@openmcp/contracts";

import { useImports, useImportServers } from "./useClients";
import { Sheet, SheetFooter } from "@/components/Sheet";
import { ipcErrorMessage } from "@/lib/ipcError";
import { Callout } from "@/components/Callout";
import { Button } from "@/components/Button";
import { Tag } from "@/components/Tag";
import { toast } from "@/lib/toast";

const servers = (count: number) => (count === 1 ? "1 server" : `${count} servers`);
const keyOf = (id: string, name: string) => `${id}:${name}`;

type ImportRowProps = { entry: ImportEntry; checked: boolean; onChange: (checked: boolean) => void };

function ImportRow({ entry, checked, onChange }: ImportRowProps) {
  const details = useId();

  return (
    <label className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 has-[:enabled]:hover:bg-tint-1">
      <input
        type="checkbox"
        className="mt-[3px] accent-primary"
        aria-label={entry.name}
        aria-describedby={details}
        checked={checked}
        disabled={entry.reason !== null}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <b className="truncate font-medium">{entry.name}</b>
          {entry.existing && <Tag>Already in OpenMCP</Tag>}
        </span>
        <span id={details} className="flex min-w-0 flex-col gap-0.5">
          {entry.serverName !== entry.name && entry.reason === null && (
            <span className="text-xs text-muted-foreground">Imports as {entry.serverName}</span>
          )}
          {entry.summary && (
            <span className="truncate font-mono text-[11.5px] leading-[15px] text-muted-foreground">
              {entry.summary}
            </span>
          )}
          {entry.reason && <span className="text-xs text-warn-ink">{entry.reason}</span>}
        </span>
      </span>
    </label>
  );
}

export function ImportServers({ clients }: { clients: ClientState[] }) {
  const imports = useImports();
  const importServers = useImportServers();
  const [open, setOpen] = useState(false);
  const [unchecked, setUnchecked] = useState(new Set<string>());

  const found = (imports.data ?? []).flatMap(({ id, entries }) => {
    const client = clients.find((candidate) => candidate.id === id);
    return client && entries.length > 0 ? [{ client, entries }] : [];
  });
  const ready = found.flatMap(({ client, entries }) =>
    entries.filter((entry) => entry.reason === null).map((entry) => ({ id: client.id, ...entry }))
  );
  const picked = ready.filter(({ id, name }) => !unchecked.has(keyOf(id, name)));
  const count = new Set(picked.map(({ serverName }) => serverName)).size;
  const agents = new Intl.ListFormat("en").format(
    found.filter(({ entries }) => entries.some((entry) => entry.reason === null)).map(({ client }) => client.name)
  );

  function toggle(key: string, checked: boolean) {
    importServers.reset();
    setUnchecked((current) => {
      const next = new Set(current);
      if (checked) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const submit = () =>
    importServers.mutate(
      picked.map(({ id, name }) => ({ id, name })),
      {
        onSuccess: (names) => {
          toast(`Moved ${servers(names.length)} into OpenMCP`);
          setOpen(false);
        }
      }
    );

  return (
    <>
      {ready.length > 0 && (
        <Callout
          tone="accent"
          icon={<ArrowDownToLine />}
          title={`Found ${servers(new Set(ready.map(({ serverName }) => serverName)).size)} in ${agents}`}
          actions={
            <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
              Review servers
            </Button>
          }
        >
          <p className="text-xs text-muted-foreground">
            Move them into OpenMCP and your agents reach them through it, instead of each running its own copy.
          </p>
        </Callout>
      )}

      <Sheet
        open={open}
        onOpenChange={setOpen}
        onClosed={() => {
          setUnchecked(new Set());
          importServers.reset();
        }}
        title="Import servers from your agents"
        description="OpenMCP adds the servers you pick, then removes them from each agent’s config and connects the agent instead. A backup of each file is kept."
      >
        <div className="-mx-2.5 flex max-h-[55vh] flex-col gap-3 overflow-auto">
          {found.map(({ client, entries }) => (
            <fieldset key={client.id} className="flex min-w-0 flex-col">
              <legend className="px-2.5 pb-1 text-[11px] font-semibold text-muted-foreground">{client.name}</legend>
              {entries.map((entry) => (
                <ImportRow
                  key={entry.name}
                  entry={entry}
                  checked={entry.reason === null && !unchecked.has(keyOf(client.id, entry.name))}
                  onChange={(checked) => toggle(keyOf(client.id, entry.name), checked)}
                />
              ))}
            </fieldset>
          ))}
        </div>
        {importServers.error && (
          <p role="alert" className="text-xs text-destructive">
            {ipcErrorMessage(importServers.error)}
          </p>
        )}
        <SheetFooter>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            busy={importServers.isPending}
            disabled={count === 0 || importServers.isPending}
            onClick={submit}
          >
            Import {servers(count)}
          </Button>
        </SheetFooter>
      </Sheet>
    </>
  );
}
