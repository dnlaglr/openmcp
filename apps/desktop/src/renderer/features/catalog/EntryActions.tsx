import { Check } from "lucide-react";

import type { AvailableUpdate, CatalogEntry, InstalledServer } from "@openmcp/contracts";

import { useInstalledServer, useRuntimes, useUpdates } from "./useCatalog";
import { Button } from "@/components/Button";
import { checkRunner } from "./runtimes";
import { Tag } from "@/components/Tag";

export type CatalogActions = {
  install: (entry: CatalogEntry) => void;
  update: (update: AvailableUpdate) => void;
  open: (server: InstalledServer) => void;
};

type EntryActionsProps = { entry: CatalogEntry; compact: boolean; actions: CatalogActions };

export function EntryActions({ entry, compact, actions }: EntryActionsProps) {
  const installed = useInstalledServer()(entry.name);
  const update = useUpdates().find((candidate) => candidate.entry.name === entry.name);
  const { data: runtimes } = useRuntimes();
  const check = checkRunner(entry.runner, runtimes);

  if (installed && update)
    return (
      <Button
        size="sm"
        variant="primary"
        aria-label={`Update ${entry.title} to v${update.entry.version}`}
        onClick={() => actions.update(update)}
      >
        {compact ? "Update" : `Update to v${update.entry.version}`}
      </Button>
    );

  if (installed)
    return (
      <>
        <span className="flex animate-pop items-center gap-1 text-xs text-ok-ink">
          <Check className="size-3.5" />
          Installed
        </span>
        {!compact && (
          <button
            type="button"
            aria-label={`Open ${entry.title} in Servers`}
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => actions.open(installed)}
          >
            Open
          </button>
        )}
      </>
    );

  return (
    <>
      {check && !check.ready && <Tag tone="warn">Needs {check.info.name}</Tag>}
      <Button size="sm" aria-label={`Install ${entry.title}`} onClick={() => actions.install(entry)}>
        Install
      </Button>
    </>
  );
}
