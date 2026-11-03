import type { CatalogEntry } from "@openmcp/contracts";

import { EntryActions, type CatalogActions } from "./EntryActions";
import { Tag } from "@/components/Tag";

type CatalogCardProps = { entry: CatalogEntry; index: number; actions: CatalogActions };

export function CatalogCard({ entry, index, actions }: CatalogCardProps) {
  return (
    <div
      className="flex min-h-[150px] animate-[up_var(--d3)_var(--ease-out)_both] flex-col gap-1.5 rounded-[10px] p-3.5 ring-1 ring-border transition-shadow duration-(--d2) hover:shadow-md"
      style={{ animationDelay: `${Math.min(index, 10) * 25}ms` }}
    >
      <div className="flex items-center gap-2">
        <b className="min-w-0 flex-1 truncate font-semibold">{entry.title}</b>
        <Tag mono>{entry.runner}</Tag>
      </div>
      <span className="truncate font-mono text-[11px] leading-[14px] text-muted-foreground">{entry.name}</span>
      <p className="line-clamp-3 flex-1 text-[12.5px] leading-[17px] text-muted-foreground">{entry.description}</p>
      <div className="flex min-h-6 items-center justify-end gap-2">
        {entry.deprecated !== null && (
          <Tag tone="danger" className="mr-auto">
            Deprecated
          </Tag>
        )}
        <EntryActions entry={entry} compact={false} actions={actions} />
      </div>
    </div>
  );
}
