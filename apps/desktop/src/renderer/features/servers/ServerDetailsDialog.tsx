import { useEffect, useState, type ReactNode } from "react";
import { cn } from "cn";

import { commandLine, type InstalledServer, type ServerDetails, type ServerState } from "@openmcp/contracts";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromptList, ResourceList, ToolList } from "./ServerCapabilities";
import { formatTime, formatUptime } from "./serverDetails";
import { ServerStatusBadge } from "./ServerStatusBadge";
import { ServerControls } from "./ServerControls";
import { ipcErrorMessage } from "@/lib/ipcError";
import { useServerDetails } from "./useServers";
import { ServerLogs } from "./ServerLogs";

type Tab = { value: string; label: string; count?: number; content: ReactNode };

export function ServerDetailsDialog({
  server,
  state,
  open,
  onOpenChange
}: {
  server: InstalledServer;
  state: ServerState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const details = useServerDetails(state);
  const [tab, setTab] = useState("tools");

  const tabs = detailTabs(server.id, details.data);
  const current = tabs.some(({ value }) => value === tab) ? tab : tabs[0].value;
  const error = state.error ?? (details.error ? ipcErrorMessage(details.error) : null);
  const instructions = details.data?.instructions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(44rem,calc(100dvh-2rem))] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader className="pr-10">
          <div className="flex items-center gap-3">
            <DialogTitle>{server.name}</DialogTitle>
            <ServerStatusBadge state={state} />
            <div className="ml-auto">
              <ServerControls server={server} state={state} />
            </div>
          </div>
          <DialogDescription className="truncate font-mono text-xs">{commandLine(server.launch)}</DialogDescription>
        </DialogHeader>

        <ServerStats state={state} details={details.data} />

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!error && state.status !== "running" && (
          <p className="text-muted-foreground">Start the server to see its tools, prompts and resources.</p>
        )}
        {instructions && (
          <p className="line-clamp-2 text-muted-foreground" title={instructions}>
            {instructions}
          </p>
        )}

        <Tabs value={current} onValueChange={setTab} className="min-h-0 flex-1">
          <TabsList>
            {tabs.map(({ value, label, count }) => (
              <TabsTrigger key={value} value={value}>
                {label}
                {count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map(({ value, content }) => (
            <TabsContent key={value} value={value} className="min-h-0 overflow-y-auto">
              {content}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function detailTabs(serverId: string, details?: ServerDetails): Tab[] {
  const tabs: Tab[] = [];

  if (details?.tools) {
    tabs.push({
      value: "tools",
      label: "Tools",
      count: details.tools.length,
      content: <ToolList tools={details.tools} />
    });
  }
  if (details?.prompts) {
    const content = <PromptList prompts={details.prompts} />;
    tabs.push({ value: "prompts", label: "Prompts", count: details.prompts.length, content });
  }
  if (details?.resources) {
    const content = <ResourceList resources={details.resources} />;
    tabs.push({ value: "resources", label: "Resources", count: details.resources.length, content });
  }
  tabs.push({ value: "logs", label: "Logs", content: <ServerLogs serverId={serverId} /> });

  return tabs;
}

function ServerStats({ state, details }: { state: ServerState; details?: ServerDetails }) {
  const now = useNow(state.status === "running");
  const info = details?.info;

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl bg-muted/50 p-4 sm:grid-cols-4">
      <Stat label="Server" className="col-span-2">
        {info ? `${info.title ?? info.name} ${info.version}` : "—"}
      </Stat>
      <Stat label="Protocol">{details?.protocolVersion ?? "—"}</Stat>
      <Stat label="Uptime">{state.startedAt ? formatUptime(now - state.startedAt.getTime()) : "—"}</Stat>
      <Stat label="Started">{state.startedAt ? formatTime(state.startedAt) : "—"}</Stat>
      <Stat label="Restarts">{state.restarts}</Stat>
      <Stat label="PID">{state.pid ?? "—"}</Stat>
    </dl>
  );
}

function Stat({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function useNow(ticking: boolean) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!ticking) return;

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);

  return now;
}
