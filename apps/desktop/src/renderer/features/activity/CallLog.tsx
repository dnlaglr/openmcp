import { useRef, useState, type ReactNode } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { ArrowUp, ChevronRight } from "lucide-react";
import { cn } from "cn";

import { CLIENT_NAMES, type ActivityEntry, type ActivityOutcome, type ActivityScope } from "@openmcp/contracts";

import { formatCount, formatDuration, formatWhen } from "./activityFormat";
import { useActivityTrail, useLiveTrail } from "./useActivity";
import { useClients } from "@/features/agents/useClients";
import { useVisibility } from "@/hooks/useVisibility";
import { Segmented } from "@/components/Segmented";
import { ipcErrorMessage } from "@/lib/ipcError";
import { Button } from "@/components/Button";
import { Tag } from "@/components/Tag";

const columns = "grid-cols-[84px_112px_112px_minmax(0,1fr)_72px_104px]";
const caption = "text-[11px] font-semibold text-muted-foreground";

const outcomes: Record<ActivityOutcome, { label: string; dot: string }> = {
  ok: { label: "OK", dot: "bg-status-running" },
  tool_error: { label: "Tool error", dot: "bg-status-attention" },
  error: { label: "Error", dot: "bg-destructive" },
  unavailable: { label: "Unavailable", dot: "bg-status-attention" }
};

const help: Record<Exclude<ActivityOutcome, "ok">, string> = {
  tool_error: "The tool ran and reported a failure. The agent saw this message.",
  error: "The server couldn’t answer. Check its logs on the Servers page.",
  unavailable: "No running server offers this call. Check the Servers page."
};

type EntryProps = { entry: ActivityEntry; agent: string; fresh: boolean; open: boolean; onToggle: () => void };

function Entry({ entry, agent, fresh, open, onToggle }: EntryProps) {
  const outcome = outcomes[entry.outcome];
  const row = cn("grid min-h-9 w-full items-center gap-x-3 px-3 text-left text-xs", columns);
  const cells: ReactNode = (
    <>
      <span className="text-muted-foreground tabular-nums">{formatWhen(entry.at)}</span>
      <span className="truncate">{agent}</span>
      <span className="truncate">{entry.serverName ?? "—"}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <Tag mono>{entry.kind}</Tag>
        <span className="truncate font-mono">{entry.name}</span>
        {entry.outcome !== "ok" && (
          <ChevronRight
            className={cn(
              "size-3 shrink-0 text-muted-foreground transition-transform duration-(--d3) ease-(--ease-move)",
              open && "rotate-90"
            )}
          />
        )}
      </span>
      <span className="text-right tabular-nums">{formatDuration(entry.durationMs)}</span>
      <span className="flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full", outcome.dot)} />
        {outcome.label}
      </span>
    </>
  );

  return (
    <li className="presence [&+&]:border-t" data-entering={fresh || undefined}>
      <div className={cn(fresh && "animate-[flash_1400ms_var(--ease-out)]")}>
        {entry.outcome === "ok" ? (
          <div className={row}>{cells}</div>
        ) : (
          <Collapsible.Root open={open} onOpenChange={onToggle}>
            <Collapsible.Trigger className={cn(row, "outline-none hover:bg-tint-1 focus-visible:focus-halo")}>
              {cells}
            </Collapsible.Trigger>
            <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-(--d3) ease-(--ease-move) data-ending-style:h-0 data-starting-style:h-0">
              <div className="flex flex-col gap-1 pr-3 pb-3 pl-[100px] text-xs">
                {entry.error && <span className="font-mono break-all text-destructive">{entry.error}</span>}
                <span className="text-muted-foreground">{help[entry.outcome]}</span>
              </div>
            </Collapsible.Panel>
          </Collapsible.Root>
        )}
      </div>
    </li>
  );
}

type CallLogProps = { scope: ActivityScope; calls: number; words: string; filtered: boolean };

export function CallLog({ scope, calls, words, filtered }: CallLogProps) {
  const [failedOnly, setFailedOnly] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const trail = useActivityTrail(scope, failedOnly);
  const { data: clients = [] } = useClients();
  const top = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const waiting = useLiveTrail(top, calls);

  useVisibility(end, (visible) => {
    if (visible && trail.hasNextPage && !trail.isFetchingNextPage) void trail.fetchNextPage();
  });

  const entries = trail.data?.pages.flat() ?? [];
  const newest = trail.data ? (entries[0]?.id ?? 0) : null;
  const [mark, setMark] = useState({ newest, before: newest });
  if (newest !== mark.newest) setMark({ newest, before: mark.newest ?? newest });

  const agentOf = (client: string | null) =>
    client === null ? "—" : (clients.find((agent) => CLIENT_NAMES[agent.id].test(client))?.name ?? client);

  let empty = "No calls yet.";
  if (failedOnly) empty = `No failed calls in the ${words}.`;
  else if (filtered) empty = "No calls match these filters.";

  return (
    <section aria-label="Calls" className="flex flex-col gap-2">
      {waiting > 0 && (
        <div className="sticky top-3 z-10 flex h-0 justify-center">
          <Button
            size="sm"
            variant="primary"
            className="animate-pop rounded-full"
            onClick={() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <ArrowUp />
            {waiting} {waiting === 1 ? "new call" : "new calls"}
          </Button>
        </div>
      )}

      <div ref={top} className="flex items-center gap-3">
        <h3 className={caption}>Calls</h3>
        {entries.length > 0 && (
          <span className="text-xs text-muted-foreground">Newest first · showing {formatCount(entries.length)}</span>
        )}
        <span className="ml-auto">
          <Segmented
            label="Outcome"
            options={[
              { value: "all", label: "All" },
              { value: "failed", label: "Failed" }
            ]}
            value={failedOnly ? "failed" : "all"}
            onChange={(value) => setFailedOnly(value === "failed")}
          />
        </span>
      </div>

      <div className="rounded-[10px] ring-1 ring-border">
        <div className={cn("grid h-[30px] items-center gap-x-3 border-b px-3", columns, caption)}>
          <span>Time</span>
          <span>Agent</span>
          <span>Server</span>
          <span>Call</span>
          <span className="text-right">Duration</span>
          <span>Outcome</span>
        </div>
        <ul>
          {entries.map((entry) => (
            <Entry
              key={entry.id}
              entry={entry}
              agent={agentOf(entry.client)}
              fresh={mark.before !== null && entry.id > mark.before}
              open={open === entry.id}
              onToggle={() => setOpen(open === entry.id ? null : entry.id)}
            />
          ))}
        </ul>
        {trail.isSuccess && entries.length === 0 && (
          <p className="p-6 text-center text-xs text-muted-foreground">{empty}</p>
        )}
      </div>

      {trail.error && (
        <p role="alert" className="text-xs text-destructive">
          {ipcErrorMessage(trail.error)}
        </p>
      )}
      {trail.isFetchingNextPage && <p className="text-center text-xs text-muted-foreground">Loading more…</p>}
      <div ref={end} />
    </section>
  );
}
