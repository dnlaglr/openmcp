import { FolderOpen, History, type LucideIcon } from "lucide-react";

import type { ClientState, ClientStatus } from "@openmcp/contracts";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useClientAction, useRevealClient } from "./useClients";
import { TableCell, TableRow } from "@/components/ui/table";
import { ClientStatusBadge } from "./ClientStatusBadge";
import { CopyButton } from "@/components/CopyButton";
import { ipcErrorMessage } from "@/lib/ipcError";
import { Button } from "@/components/ui/button";

const primary: Partial<Record<ClientStatus, { label: string; connect: boolean }>> = {
  disconnected: { label: "Connect", connect: true },
  outdated: { label: "Update", connect: true },
  connected: { label: "Disconnect", connect: false }
};

function IconAction({ label, Icon, onClick }: { label: string; Icon: LucideIcon; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} />}>
        <Icon />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function ClientRow({ client }: { client: ClientState }) {
  const action = useClientAction();
  const reveal = useRevealClient();
  const button = primary[client.status];
  const failure = action.error ?? reveal.error;

  return (
    <TableRow>
      <TableCell className="font-medium">
        {client.name}
        {client.hint && <p className="text-xs font-normal text-muted-foreground">{client.hint}</p>}
        {failure && (
          <p role="alert" className="max-w-96 text-xs font-normal whitespace-normal text-destructive">
            {ipcErrorMessage(failure)}
          </p>
        )}
      </TableCell>
      <TableCell>
        <ClientStatusBadge client={client} />
      </TableCell>
      <TableCell className="max-w-80 truncate font-mono text-xs text-muted-foreground">
        {client.path ? (
          <Tooltip>
            <TooltipTrigger render={<span />}>{client.path}</TooltipTrigger>
            <TooltipContent>{client.path}</TooltipContent>
          </Tooltip>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {button && (
            <Button
              size="sm"
              variant={button.connect ? "default" : "outline"}
              disabled={action.isPending}
              onClick={() => action.mutate({ id: client.id, connect: button.connect })}
            >
              {button.label}
            </Button>
          )}
          <CopyButton label={`Copy ${client.name} config`} value={client.snippet} variant="ghost" size="icon-sm" />
          {client.path && (
            <>
              <IconAction
                label="Show config file"
                Icon={FolderOpen}
                onClick={() => reveal.mutate({ id: client.id, target: "config" })}
              />
              <IconAction
                label="Open backups"
                Icon={History}
                onClick={() => reveal.mutate({ id: client.id, target: "backups" })}
              />
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
