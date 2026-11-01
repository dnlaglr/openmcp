import { Fragment, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "cn";

import type { InstalledServer } from "@openmcp/contracts";

import { usePresence } from "@/hooks/usePresence";
import type { Presence } from "@/lib/presence";
import { columns } from "./ServerRow";

type ServerListProps = {
  servers: InstalledServer[];
  compact: boolean;
  selected: string | null;
  empty?: ReactNode;
  onSelect: (id: string) => void;
  renderRow: (server: InstalledServer, presence: Presence) => ReactNode;
};

const keyOf = (server: InstalledServer) => server.id;

export function ServerList({ servers, compact, selected, empty, onSelect, renderRow }: ServerListProps) {
  const rows = usePresence(servers, keyOf);

  function move(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (!event.currentTarget.contains(event.target as Node) || servers.length === 0) return;

    event.preventDefault();
    const index = servers.findIndex((server) => server.id === selected);
    const next = event.key === "ArrowDown" ? Math.min(servers.length - 1, index + 1) : Math.max(0, index - 1);
    const id = servers[next].id;

    onSelect(id);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-row-id="${id}"] .row-hit`)?.focus();
  }

  return (
    <div
      data-compact={compact || undefined}
      onKeyDown={move}
      className="group/list min-h-0 overflow-auto px-2 pt-1.5 pb-4"
    >
      <div
        className={cn("grid h-7 items-center gap-x-3 px-3 text-[11px] font-semibold text-muted-foreground", columns)}
      >
        <span>Name</span>
        <span className="text-right group-data-[compact]/list:hidden">Tools</span>
        <span className="text-right group-data-[compact]/list:hidden">Calls · 24h</span>
        <span>Status</span>
        <span />
      </div>
      {rows.map(({ item, presence }) => (
        <Fragment key={item.id}>{renderRow(item, presence)}</Fragment>
      ))}
      {rows.length === 0 && empty && <p className="p-8 text-center text-muted-foreground">{empty}</p>}
    </div>
  );
}
