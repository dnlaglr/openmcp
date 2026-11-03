import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronRight, Ellipsis } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

import type { ClientState } from "@openmcp/contracts";

import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/Menu";
import { agentStatus, lastActive, masked } from "./agentStatus";
import { useClientAction, useRevealClient } from "./useClients";
import { CopyButton } from "@/components/CopyButton";
import { StatusLed } from "@/components/StatusLed";
import { ipcErrorMessage } from "@/lib/ipcError";
import { Tooltip } from "@/components/Tooltip";
import { Button } from "@/components/Button";
import { AgentLogo } from "./AgentLogo";
import { toast } from "@/lib/toast";

export const agentColumns = "grid-cols-[minmax(0,1fr)_150px_200px_132px]";

type AgentRowProps = {
  client: ClientState;
  token?: string;
  waiting: boolean;
  now: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: (client: ClientState) => void;
};

export function AgentRow({ client, token, waiting, now, open, onOpenChange, onConnected }: AgentRowProps) {
  const action = useClientAction();
  const reveal = useRevealClient();
  const status = agentStatus(client, action.isPending && action.variables.connect);
  const last = lastActive(client, waiting, now);
  const failure = action.error ?? reveal.error;
  const connected = client.status === "connected" || client.status === "outdated";

  function connect() {
    action.mutate(
      { id: client.id, connect: true },
      {
        onSuccess: (state) => {
          onConnected(state);
          toast(state.hint ? `Connected ${state.name} · ${state.hint}` : `Connected ${state.name}`);
        }
      }
    );
  }

  const disconnect = () =>
    action.mutate(
      { id: client.id, connect: false },
      { onSuccess: () => toast(`Disconnected ${client.name} · a backup was kept`) }
    );
  const showFile = () => reveal.mutate({ id: client.id, target: "config" });
  const openBackups = () => reveal.mutate({ id: client.id, target: "backups" });
  const copySnippet = () =>
    void navigator.clipboard.writeText(client.snippet).then(() => toast(`Copied ${client.name}’s snippet`));

  let cta: ReactNode = null;
  if (client.status === "disconnected" || client.status === "outdated") {
    const label = client.status === "outdated" ? "Update" : "Connect";
    cta = (
      <Button
        size="sm"
        variant="primary"
        aria-label={`${label} ${client.name}`}
        busy={action.isPending}
        disabled={action.isPending}
        onClick={connect}
      >
        {label}
      </Button>
    );
  } else if (client.status === "error") {
    cta = (
      <Button size="sm" aria-label={`Show ${client.name}’s config file`} onClick={showFile}>
        Show file
      </Button>
    );
  }

  let intro = "Connect adds this entry. Everything else in the file stays as it is:";
  if (client.status === "connected") intro = "OpenMCP added this entry to the file:";
  else if (client.status === "outdated") intro = "Update writes this entry:";

  return (
    <Collapsible.Root
      role="group"
      aria-label={client.name}
      open={open}
      onOpenChange={onOpenChange}
      className="[&+&]:border-t"
    >
      <div
        className={cn(
          "relative grid min-h-[58px] items-center gap-x-3 px-3.5 transition-colors duration-(--d1) hover:bg-tint-1",
          agentColumns,
          open && "bg-tint-1"
        )}
      >
        <Collapsible.Trigger
          aria-label={`${open ? "Hide" : "Show"} details for ${client.name}`}
          className="absolute inset-0 outline-none focus-visible:focus-halo"
        />
        <span className="pointer-events-none relative flex min-w-0 items-center gap-3">
          <ChevronRight
            className={cn(
              "size-3 shrink-0 text-muted-foreground transition-transform duration-(--d3) ease-(--ease-move)",
              open && "rotate-90"
            )}
          />
          <AgentLogo id={client.id} />
          <span className="flex min-w-0 flex-col">
            <b className="font-medium">{client.name}</b>
            {client.status === "error" ? (
              <span className="truncate text-xs text-destructive">Couldn’t read {client.path}</span>
            ) : (
              <span className="truncate font-mono text-[11.5px] leading-[15px] text-muted-foreground">
                {client.path}
              </span>
            )}
          </span>
        </span>
        <StatusLed className="pointer-events-none relative" status={status.led} label={status.label} />
        <span
          className={cn(
            "pointer-events-none relative flex items-center gap-2 text-xs text-muted-foreground",
            last.tone === "live" && "text-ok-ink",
            last.tone === "waiting" && "text-foreground"
          )}
        >
          {last.tone === "waiting" && <StatusLed status="starting" />}
          {last.tone === "live" && <StatusLed status="running" />}
          {last.text}
        </span>
        <span className="relative flex items-center justify-end gap-1">
          {cta}
          <Menu>
            <Tooltip label={`More actions for ${client.name}`}>
              <MenuTrigger
                render={<Button variant="ghost" size="icon" aria-label={`More actions for ${client.name}`} />}
              >
                <Ellipsis />
              </MenuTrigger>
            </Tooltip>
            <MenuContent>
              <MenuItem onClick={copySnippet}>Copy config snippet</MenuItem>
              {client.path && <MenuItem onClick={showFile}>Show config file</MenuItem>}
              {client.path && <MenuItem onClick={openBackups}>Open backups</MenuItem>}
              {connected && (
                <>
                  <MenuSeparator />
                  <MenuItem danger onClick={disconnect}>
                    Disconnect
                  </MenuItem>
                </>
              )}
            </MenuContent>
          </Menu>
        </span>
      </div>
      <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-(--d3) ease-(--ease-move) data-ending-style:h-0 data-starting-style:h-0">
        <div className="flex flex-col gap-2.5 pt-1 pr-3.5 pb-4 pl-[58px]">
          {failure && (
            <p role="alert" className="text-xs text-destructive">
              {ipcErrorMessage(failure)}
            </p>
          )}
          {client.status === "error" && (
            <div className="rounded-lg bg-destructive/7 px-3 py-2.5 text-xs ring-1 ring-destructive/25 ring-inset">
              OpenMCP couldn’t read this file, so it left it alone. Fix it, or restore a backup.
              <span className="mt-1 block font-mono text-destructive">{client.error}</span>
            </div>
          )}
          {client.status === "outdated" && (
            <p className="text-xs">
              Its entry doesn’t match the gateway’s current address or token. Update rewrites it.
            </p>
          )}
          <p className="text-xs text-muted-foreground">{intro}</p>
          <div className="relative">
            <pre className="overflow-auto rounded-lg bg-tint-1 py-2.5 pr-10 pl-3 font-mono text-[11.5px] leading-[18px] ring-1 ring-border ring-inset">
              {masked(client.snippet, token)}
            </pre>
            <span className="absolute top-1.5 right-1.5">
              <CopyButton
                label="Copy snippet"
                value={client.snippet}
                onCopied={() => toast(`Copied ${client.name}’s snippet`)}
              />
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {client.path && (
              <>
                <Button size="sm" onClick={showFile}>
                  Show config file
                </Button>
                <Button size="sm" onClick={openBackups}>
                  Open backups · {client.backups}
                </Button>
              </>
            )}
            {connected && (
              <Button size="sm" variant="danger" className="ml-auto" disabled={action.isPending} onClick={disconnect}>
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
