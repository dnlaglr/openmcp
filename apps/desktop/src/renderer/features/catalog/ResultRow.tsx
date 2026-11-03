import type { CatalogEntry } from "@openmcp/contracts";

import { EntryActions, type CatalogActions } from "./EntryActions";
import { Tag } from "@/components/Tag";

type ResultRowProps = { entry: CatalogEntry; index: number; actions: CatalogActions };

export function ResultRow({ entry, index, actions }: ResultRowProps) {
  return (
    <div
      className="grid min-h-14 animate-[up_var(--d3)_var(--ease-out)_both] grid-cols-[minmax(0,220px)_minmax(0,1fr)_70px_120px] items-center gap-4 px-3.5 py-2 transition-colors duration-(--d1) hover:bg-tint-1 [&+&]:border-t"
      style={{ animationDelay: `${Math.min(index, 10) * 25}ms` }}
    >
      <span className="flex min-w-0 flex-col">
        <b className="truncate font-medium">{entry.title}</b>
        <span className="truncate font-mono text-[11px] text-muted-foreground">{entry.name}</span>
      </span>
      <span title={entry.description} className="truncate text-[12.5px] text-muted-foreground">
        {entry.description}
      </span>
      <span>
        <Tag mono>{entry.runner}</Tag>
      </span>
      <span className="flex items-center justify-end gap-2">
        <EntryActions entry={entry} compact actions={actions} />
      </span>
    </div>
  );
}
