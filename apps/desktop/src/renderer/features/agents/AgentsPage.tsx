import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "cn";

import type { ClientId, ClientState } from "@openmcp/contracts";

import { useGatewayConnection } from "@/features/settings/useGateway";
import { useAgentCounts, useClients } from "./useClients";
import { ErrorState } from "@/components/ErrorState";
import { Disclosure } from "@/components/Disclosure";
import { agentColumns, AgentRow } from "./AgentRow";
import type { PageProps } from "@/lib/navigation";
import { Skeleton } from "@/components/Skeleton";
import { ImportServers } from "./ImportServers";
import { Callout } from "@/components/Callout";
import { Toolbar } from "@/components/Toolbar";
import { OtherAgents } from "./OtherAgents";
import { isWaiting } from "./agentStatus";
import { AgentLogo } from "./AgentLogo";
import { useNow } from "@/hooks/useNow";
import { toast } from "@/lib/toast";

const head = "grid h-[30px] items-center gap-x-3 border-b px-3.5 text-[11px] font-semibold text-muted-foreground";

function ListHead() {
  return (
    <div className={cn(head, agentColumns)}>
      <span>Agent</span>
      <span>Status</span>
      <span>Last active</span>
      <span />
    </div>
  );
}

function AgentsSkeleton() {
  return (
    <div className="delayed mx-6 mt-5 rounded-[10px] ring-1 ring-border">
      <ListHead />
      {["w-1/5", "w-1/4", "w-1/6"].map((width) => (
        <div key={width} className="flex min-h-[58px] items-center gap-3 px-3.5 [&+&]:border-t">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className={width} />
            <Skeleton className="w-2/5" />
          </div>
          <Skeleton className="w-[120px]" />
        </div>
      ))}
    </div>
  );
}

export function AgentsPage({ navigate }: PageProps) {
  const clients = useClients();
  const { data: connection } = useGatewayConnection();
  const counts = useAgentCounts();
  const now = useNow(true);
  const [open, setOpen] = useState<ClientId | null>(null);
  const [connectedAt, setConnectedAt] = useState<Partial<Record<ClientId, number>>>({});
  const announced = useRef(new Map<ClientId, number>());

  const all = clients.data ?? [];
  const installed = all.filter((client) => client.status !== "missing");
  const missing = all.filter((client) => client.status === "missing");

  useEffect(() => {
    for (const client of clients.data ?? []) {
      const since = connectedAt[client.id];
      if (since === undefined || client.status !== "connected" || isWaiting(client, since)) continue;
      if (announced.current.get(client.id) === since) continue;

      announced.current.set(client.id, since);
      toast(`${client.name} is using OpenMCP`);
    }
  }, [clients.data, connectedAt]);

  const connected = (client: ClientState) => setConnectedAt((current) => ({ ...current, [client.id]: Date.now() }));

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && event.currentTarget.contains(event.target as Node)) setOpen(null);
  }

  let subtitle = "Looking for agents on this machine…";
  if (clients.isSuccess)
    subtitle = `${counts.connected} of ${counts.installed} connected${counts.active ? ` · ${counts.active} active now` : ""}`;
  if (clients.error) subtitle = "";

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={closeOnEscape}>
      <Toolbar title="Agents" subtitle={subtitle || undefined} />

      {clients.isPending && <AgentsSkeleton />}
      {clients.error && (
        <ErrorState title="Couldn’t look for agents" error={clients.error} onRetry={() => void clients.refetch()} />
      )}
      {clients.isSuccess && (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="flex flex-col gap-[18px] px-6 pt-5 pb-8">
            {counts.connected === 0 && (
              <Callout tone="accent" title="Connect an agent to start">
                <p className="text-xs text-muted-foreground">
                  Each agent you connect gets every server you install here. OpenMCP edits its config file and keeps a
                  backup first.
                </p>
              </Callout>
            )}
            <ImportServers clients={installed} />

            <div className="rounded-[10px] ring-1 ring-border">
              <ListHead />
              {installed.map((client) => (
                <AgentRow
                  key={client.id}
                  client={client}
                  token={connection?.token}
                  waiting={isWaiting(client, connectedAt[client.id])}
                  now={now}
                  open={open === client.id}
                  onOpenChange={(next) => setOpen(next ? client.id : null)}
                  onConnected={connected}
                />
              ))}
              {installed.length === 0 && (
                <p className="p-6 text-center text-muted-foreground">
                  No supported agents are installed on this computer.
                </p>
              )}
            </div>

            {missing.length > 0 && (
              <Disclosure title={`Not installed · ${missing.length}`}>
                {missing.map((client) => (
                  <div
                    key={client.id}
                    className="flex min-h-[52px] items-center gap-3 rounded-[10px] px-3.5 opacity-60 ring-1 ring-border"
                  >
                    <AgentLogo id={client.id} />
                    <span className="flex min-w-0 flex-col">
                      <b className="font-medium">{client.name}</b>
                      <span className="truncate text-xs text-muted-foreground">
                        Install {client.name} and it shows up here, ready to connect.
                      </span>
                    </span>
                  </div>
                ))}
              </Disclosure>
            )}

            <OtherAgents navigate={navigate} />
          </div>
        </div>
      )}
    </div>
  );
}
