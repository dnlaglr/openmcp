import { Check } from "lucide-react";
import { cn } from "cn";

import type { CatalogEntry, ClientState } from "@openmcp/contracts";

import { useInstalledServer, useInstallServer, usePopular } from "@/features/catalog/useCatalog";
import { initialInstallForm, toInstallInput } from "@/features/catalog/installForm";
import { useClientAction, useClients } from "@/features/agents/useClients";
import { useServerCounts, useServerStates } from "./useServers";
import { StatusLed } from "@/components/StatusLed";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { Tag } from "@/components/Tag";

const link = "text-xs font-medium text-primary hover:underline";
const card = "flex flex-col gap-3 rounded-xl p-4 ring-1 ring-border";

function StepNumber({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={cn(
        "grid size-[22px] shrink-0 place-items-center rounded-full text-xs font-semibold",
        done ? "animate-pop bg-status-running text-white" : "bg-tint-2 text-muted-foreground"
      )}
    >
      {done ? <Check className="size-3" strokeWidth={3} /> : n}
    </span>
  );
}

function PickCard({ entry, onInstall }: { entry: CatalogEntry; onInstall: () => void }) {
  const install = useInstallServer();
  const server = useInstalledServer()(entry.name);
  const stateOf = useServerStates();
  const countsOf = useServerCounts();
  const status = server ? stateOf(server.id).status : null;
  const tools = server ? countsOf(server.id)?.tools : undefined;

  let footer = (
    <Button
      size="sm"
      aria-label={`Install ${entry.title}`}
      onClick={() => {
        onInstall();
        install.mutate(toInstallInput(entry, initialInstallForm(entry)));
      }}
    >
      Install
    </Button>
  );
  if (install.isPending || status === "starting")
    footer = <StatusLed status="starting" label="Installing and starting…" />;
  else if (status === "running")
    footer = <StatusLed status="running" label={tools === undefined ? "Running" : `Running · ${tools} tools`} />;
  else if (status === "error") footer = <StatusLed status="error" label="Installed, but it couldn’t start" />;
  else if (server) footer = <StatusLed status="stopped" label="Installed" />;

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-[9px] p-3 ring-1 ring-border ring-inset transition-colors duration-(--d3)",
        status === "running" && "bg-status-running/6 ring-status-running/35"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <b className="font-semibold">{entry.title}</b>
        <Tag mono>{entry.runner}</Tag>
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">{entry.description}</p>
      <div className="mt-0.5 flex min-h-6 items-center">{footer}</div>
    </div>
  );
}

function AgentLine({ client }: { client: ClientState }) {
  const action = useClientAction();

  return (
    <div className="flex min-h-11 items-center gap-3 px-1 py-1.5 [&+&]:border-t">
      <div className="flex min-w-0 flex-1 flex-col">
        <b className="font-medium">{client.name}</b>
        <span className="truncate font-mono text-[11px] text-muted-foreground">{client.path}</span>
      </div>
      {client.status === "connected" ? (
        <StatusLed status="running" label={client.hint ?? "Connected"} />
      ) : (
        <Button
          size="sm"
          aria-label={`Connect ${client.name}`}
          busy={action.isPending}
          disabled={action.isPending}
          onClick={() => action.mutate({ id: client.id, connect: true })}
        >
          Connect
        </Button>
      )}
    </div>
  );
}

type FirstRunProps = {
  onInstall: () => void;
  onDone: () => void;
  onAddCustom: () => void;
  onBrowse: () => void;
  canFinish: boolean;
};

export function FirstRun({ onInstall, onDone, onAddCustom, onBrowse, canFinish }: FirstRunProps) {
  const popular = usePopular();
  const { data: clients = [] } = useClients();
  const picks = (popular.data ?? []).filter((entry) => entry.inputs.every((input) => !input.required)).slice(0, 4);
  const agents = clients.filter((client) => client.status !== "missing");

  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-auto px-6 py-7">
      <div className="flex w-[640px] animate-up flex-col gap-5">
        <div className="mb-1 flex flex-col items-center gap-1.5 text-center">
          <span className="bevel-primary mb-1.5 grid size-11 place-items-center rounded-xl">
            <Logo className="size-6" />
          </span>
          <h2 className="text-xl leading-[26px] font-semibold">Set up OpenMCP</h2>
          <p className="text-muted-foreground">Install servers once, and every agent you connect can use them.</p>
        </div>

        <section className={card}>
          <div className="flex items-start gap-3">
            <StepNumber n={1} done={canFinish} />
            <div>
              <b className="font-semibold">Add a server</b>
              <p className="text-xs text-muted-foreground">These need no setup. Pick one or more.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {popular.isPending
              ? [0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="delayed flex h-[104px] flex-col gap-2.5 rounded-[9px] p-3 ring-1 ring-border"
                  >
                    <Skeleton className="w-1/2" />
                    <Skeleton className="w-11/12" />
                    <Skeleton className="w-2/3" />
                  </div>
                ))
              : picks.map((entry) => <PickCard key={entry.name} entry={entry} onInstall={onInstall} />)}
          </div>
          {popular.error && <p className="text-xs text-muted-foreground">Couldn’t load popular servers.</p>}
          <div className="flex items-center gap-2">
            <button type="button" className={link} onClick={onBrowse}>
              Browse the catalog
            </button>
            <span className="text-muted-foreground">·</span>
            <button type="button" className={link} onClick={onAddCustom}>
              Add a custom server
            </button>
          </div>
        </section>

        <section className={card}>
          <div className="flex items-start gap-3">
            <StepNumber n={2} done={agents.some((client) => client.status === "connected")} />
            <div>
              <b className="font-semibold">Connect your agents</b>
              <p className="text-xs text-muted-foreground">
                OpenMCP adds itself to each agent’s config file, and keeps a backup.
              </p>
            </div>
          </div>
          <div>
            {agents.map((client) => (
              <AgentLine key={client.id} client={client} />
            ))}
          </div>
        </section>

        <div className="flex justify-center">
          <Button variant="primary" disabled={!canFinish} onClick={onDone}>
            Go to servers
          </Button>
        </div>
      </div>
    </div>
  );
}
