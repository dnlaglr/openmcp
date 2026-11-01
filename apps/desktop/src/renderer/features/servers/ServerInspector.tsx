import { addTransitionType, startTransition, ViewTransition } from "react";
import { Globe, SquareTerminal, X } from "lucide-react";

import type { AvailableUpdate, InstalledServer, ServerCounts, ServerState } from "@openmcp/contracts";

import { ledStatus, primaryAction, statusLabel } from "./serverStatus";
import { Tab, Tabs, TabsList, TabsPanel } from "@/components/Tabs";
import { IconButton } from "@/components/IconButton";
import { StatusLed } from "@/components/StatusLed";
import type { Navigate } from "@/lib/navigation";
import type { ServerAction } from "./useServers";
import { formatUptime } from "./serverDetails";
import { Button } from "@/components/Button";
import { OverviewTab } from "./OverviewTab";
import { ServerMenu } from "./ServerMenu";
import { useNow } from "@/hooks/useNow";
import { ToolsTab } from "./ToolsTab";
import { LogsTab } from "./LogsTab";

export type InspectorTab = "overview" | "tools" | "logs";

const order: InspectorTab[] = ["overview", "tools", "logs"];
const scroll = "flex min-h-0 flex-1 flex-col gap-[18px] overflow-auto px-[18px] pt-4 pb-6 outline-none";

type ServerInspectorProps = {
  server: InstalledServer;
  state: ServerState;
  counts?: ServerCounts;
  update?: AvailableUpdate;
  waiting: boolean;
  signedIn: boolean;
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  onClose: () => void;
  onAction: (action: ServerAction) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onEdit: () => void;
  onUpdate: () => void;
  onRemove: () => void;
  navigate: Navigate;
};

export function ServerInspector(props: ServerInspectorProps) {
  const { server, state, counts, update, waiting, signedIn, tab, onTab, onClose, navigate } = props;
  const { onAction, onSignIn, onSignOut, onEdit, onUpdate, onRemove } = props;
  const now = useNow(state.status === "running");
  const primary = primaryAction(state, waiting);
  const host = server.launch.type === "http" ? new URL(server.launch.url).host : null;

  let extra = host ? `· ${host}` : "";
  if (state.status === "running" && state.startedAt) extra = `· up ${formatUptime(now - state.startedAt.getTime())}`;

  function onPrimary() {
    if (primary.kind === "stop") onAction("stop");
    else if (primary.kind === "start" || primary.kind === "retry") onAction("start");
    else onSignIn();
  }

  const changeTab = (next: InspectorTab) =>
    startTransition(() => {
      addTransitionType(order.indexOf(next) > order.indexOf(tab) ? "tab-forward" : "tab-back");
      onTab(next);
    });

  return (
    <aside
      aria-label={`${server.name} details`}
      className="flex h-full w-[440px] animate-[in-right_var(--d4)_var(--ease-out)_both] flex-col"
    >
      <div className="flex items-center gap-3 px-[18px] pt-4 pb-3">
        <span className="bevel grid size-10 shrink-0 place-items-center rounded-[10px] text-muted-foreground [&_svg]:size-[18px]">
          {host ? <Globe /> : <SquareTerminal />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="truncate text-[15px] leading-5 font-semibold">{server.name}</h2>
          <span className="flex min-w-0 items-center gap-1">
            <StatusLed status={ledStatus(state, waiting)} label={statusLabel(state, host !== null, waiting)} />
            <span className="truncate text-xs text-muted-foreground tabular-nums">{extra}</span>
          </span>
        </div>
        <Button
          size="sm"
          variant={primary.kind === "stop" || primary.kind === "startOver" ? "default" : "primary"}
          aria-label={primary.kind === "signIn" ? `Sign in to ${server.name}` : `${primary.label} ${server.name}`}
          onClick={onPrimary}
        >
          {primary.label}
        </Button>
        <ServerMenu
          server={server}
          state={state}
          update={update}
          signedIn={signedIn}
          onAction={onAction}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          onLogs={() => changeTab("logs")}
          onEdit={onEdit}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
        <IconButton label="Close details" onClick={onClose}>
          <X />
        </IconButton>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => changeTab(value as InspectorTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="border-b px-[18px] pb-3">
          <TabsList label="Server details">
            <Tab value="overview">Overview</Tab>
            <Tab value="tools">{state.status === "running" && counts ? `Tools ${counts.tools}` : "Tools"}</Tab>
            <Tab value="logs">Logs</Tab>
          </TabsList>
        </div>
        <ViewTransition update={{ "tab-forward": "tab-forward", "tab-back": "tab-back", default: "none" }}>
          <div key={server.id} className="flex min-h-0 flex-1 flex-col">
            <TabsPanel value="overview" className={scroll}>
              <OverviewTab
                server={server}
                state={state}
                update={update}
                waiting={waiting}
                onPrimary={onPrimary}
                onLogs={() => changeTab("logs")}
                onEdit={onEdit}
                onUpdate={onUpdate}
                navigate={navigate}
              />
            </TabsPanel>
            <TabsPanel value="tools" className={scroll}>
              <ToolsTab server={server} state={state} waiting={waiting} onPrimary={onPrimary} />
            </TabsPanel>
            <TabsPanel value="logs" className="flex min-h-0 flex-1 flex-col gap-2.5 px-[18px] pt-4 pb-4 outline-none">
              <LogsTab serverId={server.id} />
            </TabsPanel>
          </div>
        </ViewTransition>
      </Tabs>
    </aside>
  );
}
