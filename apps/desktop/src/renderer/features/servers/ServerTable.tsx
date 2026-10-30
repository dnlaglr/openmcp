import { useState } from "react";

import { commandLine, type InstalledServer } from "@openmcp/contracts";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ServerDetailsDialog } from "./ServerDetailsDialog";
import { RemoveServerButton } from "./RemoveServerButton";
import { ServerStatusBadge } from "./ServerStatusBadge";
import { EditServerButton } from "./EditServerButton";
import { ServerControls } from "./ServerControls";
import { useServerStates } from "./useServers";
import { Badge } from "@/components/ui/badge";

export function ServerTable({ servers }: { servers: InstalledServer[] }) {
  const stateOf = useServerStates();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = servers.find((server) => server.id === selectedId);

  function openDetails(id: string) {
    setSelectedId(id);
    setDetailsOpen(true);
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Command</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Autostart</TableHead>
            <TableHead className="w-0">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {servers.map((server) => {
            const state = stateOf(server.id);

            return (
              <TableRow key={server.id} className="cursor-pointer" onClick={() => openDetails(server.id)}>
                <TableCell className="font-medium">
                  <button
                    type="button"
                    className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
                  >
                    {server.name}
                  </button>
                </TableCell>
                <TableCell>
                  <ServerStatusBadge state={state} />
                </TableCell>
                <TableCell className="max-w-80 truncate font-mono text-xs text-muted-foreground">
                  {commandLine(server.launch)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{server.source === "custom" ? "Custom" : "Catalog"}</Badge>
                </TableCell>
                <TableCell>{server.autostart ? "On" : "Off"}</TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-end">
                    <ServerControls server={server} state={state} />
                    <EditServerButton server={server} state={state} />
                    <RemoveServerButton server={server} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {selected && (
        <ServerDetailsDialog
          key={selected.id}
          server={selected}
          state={stateOf(selected.id)}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}
    </>
  );
}
