import { useEffect, useRef } from "react";
import { cn } from "cn";

import { useServerLogs } from "./useServers";
import { formatTime } from "./serverDetails";

export function ServerLogs({ serverId }: { serverId: string }) {
  const { data: lines } = useServerLogs(serverId);
  const scroller = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  useEffect(() => {
    const element = scroller.current;
    if (element && following.current) element.scrollTop = element.scrollHeight;
  }, [lines]);

  if (!lines?.length) return <p className="py-8 text-center text-muted-foreground">No output yet.</p>;

  return (
    <div
      ref={scroller}
      onScroll={({ currentTarget: element }) => {
        following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 16;
      }}
      className="h-full overflow-y-auto rounded-2xl bg-muted/50 p-3 font-mono text-xs"
    >
      {lines.map((line, index) => (
        <div key={index} className={cn("flex gap-3 py-0.5", line.source === "openmcp" && "text-muted-foreground")}>
          <span className="shrink-0 text-muted-foreground tabular-nums">{formatTime(line.at)}</span>
          <span className="break-all whitespace-pre-wrap">{line.text}</span>
        </div>
      ))}
    </div>
  );
}
