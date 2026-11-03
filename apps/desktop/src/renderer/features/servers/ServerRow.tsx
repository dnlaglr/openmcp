import { Globe, Play, Square, SquareTerminal } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

import {
  launchLabel,
  type ActivityGroup,
  type AvailableUpdate,
  type InstalledServer,
  type ServerCounts,
  type ServerState
} from "@openmcp/contracts";

import { formatCount, formatRate } from "@/features/activity/activityFormat";
import { isActive, ledStatus, statusLabel } from "./serverStatus";
import { IconButton } from "@/components/IconButton";
import { StatusLed } from "@/components/StatusLed";
import type { ServerAction } from "./useServers";
import type { Presence } from "@/lib/presence";
import { Button } from "@/components/Button";
import { Tag } from "@/components/Tag";

export const columns =
  "grid-cols-[minmax(0,1fr)_76px_104px_150px_112px] group-data-[compact]/list:grid-cols-[minmax(0,1fr)_150px_112px]";

type ServerRowProps = {
  server: InstalledServer;
  state: ServerState;
  counts?: ServerCounts;
  usage?: ActivityGroup;
  update?: AvailableUpdate;
  selected: boolean;
  waiting: boolean;
  presence: Presence;
  menu: ReactNode;
  onSelect: () => void;
  onAction: (action: ServerAction) => void;
  onSignIn: () => void;
};

export function ServerRow(props: ServerRowProps) {
  const { server, state, counts, usage, update, selected, waiting, presence, menu, onSelect, onAction, onSignIn } =
    props;
  const remote = server.launch.type === "http";
  const failed = state.status === "error";
  const cell = "pointer-events-none relative min-w-0";

  return (
    <div
      role="group"
      aria-label={server.name}
      className="presence"
      data-row-id={server.id}
      data-collapsed={presence === "exiting" || undefined}
      data-entering={presence === "entering" || undefined}
    >
      <div>
        <div
          data-selected={selected || undefined}
          className={cn(
            "group/row relative grid h-[52px] items-center gap-x-3 rounded-[7px] px-3 transition-colors duration-(--d1) hover:bg-tint-1",
            columns,
            "data-selected:bg-primary data-selected:text-primary-foreground data-selected:[&_.text-muted-foreground]:text-white/80",
            presence === "entering" && "animate-[flash_1400ms_var(--ease-out)]"
          )}
        >
          <button
            type="button"
            aria-label={`Show details for ${server.name}`}
            aria-pressed={selected}
            onClick={onSelect}
            className="row-hit absolute inset-0 rounded-[inherit] outline-none focus-visible:focus-halo"
          />
          <span className={cn(cell, "flex items-center gap-2.5")}>
            <span className="bevel grid size-[30px] shrink-0 place-items-center rounded-lg text-muted-foreground [&_svg]:size-3.5">
              {remote ? <Globe /> : <SquareTerminal />}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5">
                <b className="truncate font-medium">{server.name}</b>
                {update && <Tag tone="accent">Update</Tag>}
              </span>
              <span
                className={cn(
                  "truncate font-mono text-[11.5px] leading-[15px] text-muted-foreground",
                  failed && state.error && "font-sans text-xs text-destructive"
                )}
              >
                {failed && state.error ? state.error : launchLabel(server.launch)}
              </span>
            </span>
          </span>
          <span className={cn(cell, "text-right text-xs text-muted-foreground group-data-[compact]/list:hidden")}>
            {state.status === "running" && counts ? `${counts.tools} tools` : "—"}
          </span>
          <span className={cn(cell, "flex flex-col items-end text-xs group-data-[compact]/list:hidden")}>
            {usage ? (
              <>
                <b className="font-medium tabular-nums">{formatCount(usage.calls)}</b>
                <span className="text-[11px] text-muted-foreground">
                  {formatRate(usage.failures, usage.calls)} failed
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </span>
          <StatusLed className={cell} status={ledStatus(state, waiting)} label={statusLabel(state, remote, waiting)} />
          <span className="relative flex items-center justify-end gap-1">
            {state.status === "signin" && !waiting && (
              <Button size="sm" aria-label={`Sign in to ${server.name}`} onClick={onSignIn}>
                Sign in
              </Button>
            )}
            {failed && (
              <Button size="sm" aria-label={`Retry ${server.name}`} onClick={() => onAction("start")}>
                Retry
              </Button>
            )}
            <span className="flex gap-0.5 opacity-0 transition-opacity duration-(--d2) group-hover/row:opacity-100 group-focus-within/row:opacity-100 group-data-selected/row:opacity-100 has-data-popup-open:opacity-100">
              {state.status === "stopped" && (
                <IconButton label={`Start ${server.name}`} onClick={() => onAction("start")}>
                  <Play />
                </IconButton>
              )}
              {isActive(state) && !waiting && (
                <IconButton label={`Stop ${server.name}`} onClick={() => onAction("stop")}>
                  <Square />
                </IconButton>
              )}
              {menu}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
