import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { cn } from "cn";

import { SearchField } from "@/components/SearchField";
import { Button } from "@/components/Button";
import { Switch } from "@/components/Switch";
import { formatTime } from "./serverDetails";
import { useServerLogs } from "./useServers";
import { toast } from "@/lib/toast";

const failure = /exited|error|gave up|ENOENT/i;

export function LogsTab({ serverId }: { serverId: string }) {
  const { data } = useServerLogs(serverId);
  const [query, setQuery] = useState("");
  const [follow, setFollow] = useState(true);
  const [mountedAt] = useState(Date.now);
  const well = useRef<HTMLDivElement>(null);

  const lines = data ?? [];
  const needle = query.trim().toLowerCase();
  const shown = needle ? lines.filter((line) => line.text.toLowerCase().includes(needle)) : lines;

  useEffect(() => {
    const element = well.current;
    if (element && follow) element.scrollTop = element.scrollHeight;
  }, [data, follow, needle]);

  async function copy() {
    await navigator.clipboard.writeText(shown.map((line) => `${formatTime(line.at)} ${line.text}`).join("\n"));
    toast(`Copied ${shown.length} ${shown.length === 1 ? "line" : "lines"}`);
  }

  return (
    <>
      <div className="flex items-center gap-2.5">
        <SearchField
          className="flex-1"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter"
          aria-label="Filter output"
        />
        <label className="flex items-center gap-1.5 text-xs">
          <Switch size="sm" aria-label="Follow new output" checked={follow} onCheckedChange={setFollow} />
          Follow
        </label>
        <Button size="sm" disabled={shown.length === 0} onClick={() => void copy()}>
          <Copy />
          Copy
        </Button>
      </div>
      <div
        ref={well}
        onScroll={({ currentTarget: element }) => {
          if (element.scrollHeight - element.scrollTop - element.clientHeight > 16) setFollow(false);
        }}
        className="min-h-0 flex-1 overflow-auto rounded-[9px] bg-tint-1 px-2.5 py-2 font-mono text-[11.5px] leading-[19px] ring-1 ring-border ring-inset"
      >
        {shown.map((line, index) => (
          <div
            key={index}
            className={cn(
              "flex gap-3",
              line.at.getTime() > mountedAt && "animate-up",
              line.source === "openmcp" && (failure.test(line.text) ? "text-destructive" : "text-muted-foreground")
            )}
          >
            <span className="shrink-0 text-muted-foreground tabular-nums">{formatTime(line.at)}</span>
            <span className="min-w-0 break-all whitespace-pre-wrap">{line.text}</span>
          </div>
        ))}
        {shown.length === 0 && (
          <p className="py-8 text-center font-sans text-muted-foreground">
            {lines.length ? "No lines match." : "No output yet."}
          </p>
        )}
      </div>
    </>
  );
}
