import { useQuery } from "@tanstack/react-query";

import { gatewayUrl } from "@openmcp/contracts";

import { useServers, useServerStates } from "@/features/servers/useServers";
import { useGatewayState } from "@/features/settings/useGateway";
import { useAgentCounts } from "@/features/agents/useClients";
import type { Navigate } from "@/lib/navigation";
import { UpdateItem } from "./UpdateItem";
import { StatusLed } from "./StatusLed";
import { Tooltip } from "./Tooltip";
import { toast } from "@/lib/toast";

const item = "inline-flex h-[22px] items-center gap-1.5 rounded-[5px] px-1.5 outline-none focus-visible:focus-halo";

function Gateway({ navigate }: { navigate: Navigate }) {
  const { data: state } = useGatewayState();

  if (state?.status === "running") {
    const url = gatewayUrl(state.port);
    return (
      <button
        type="button"
        aria-label="Copy the gateway URL"
        className={`${item} hover:bg-tint-2 hover:text-foreground`}
        onClick={() => void navigator.clipboard.writeText(url).then(() => toast(`Copied ${url}`))}
      >
        <StatusLed status="running" />
        Gateway <span className="font-mono">127.0.0.1:{state.port}</span>
      </button>
    );
  }

  if (state?.status === "error") {
    return (
      <Tooltip label={state.error ?? "The gateway stopped"}>
        <button type="button" className={`${item} hover:bg-tint-2`} onClick={() => navigate("settings")}>
          <StatusLed status="error" />
          Gateway stopped
        </button>
      </Tooltip>
    );
  }

  return (
    <span className={item}>
      <StatusLed status="starting" />
      Starting gateway
    </span>
  );
}

export function StatusBar({ navigate }: { navigate: Navigate }) {
  const { data: servers = [] } = useServers();
  const stateOf = useServerStates();
  const { data: version } = useQuery({
    queryKey: ["app-version"],
    queryFn: () => window.api.invoke("app:version"),
    staleTime: Infinity
  });
  const running = servers.filter((server) => stateOf(server.id).status === "running").length;
  const separator = <span aria-hidden className="h-3 w-px bg-border" />;
  const agents = useAgentCounts();
  const plural = (count: number) => (count === 1 ? "agent" : "agents");

  let agentsLine = "No agents connected";
  if (agents.active) agentsLine = `${agents.active} ${plural(agents.active)} active`;
  else if (agents.connected) agentsLine = `${agents.connected} ${plural(agents.connected)} connected`;

  return (
    <footer className="col-span-2 flex items-center gap-1 border-t bg-sidebar px-2 text-[11.5px] whitespace-nowrap text-muted-foreground">
      <Gateway navigate={navigate} />
      {separator}
      <span className={item}>
        {running} of {servers.length} servers running
      </span>
      {separator}
      <span className={item}>{agentsLine}</span>
      <span className="ml-auto" />
      <UpdateItem className={item} />
      {separator}
      {version && <span className={`${item} font-mono`}>v{version}</span>}
    </footer>
  );
}
