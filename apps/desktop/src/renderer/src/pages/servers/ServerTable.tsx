import type { InstalledServer } from "@openmcp/contracts";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RemoveServerButton } from "./RemoveServerButton";
import { Badge } from "@/components/ui/badge";


export function ServerTable({ servers }: { servers: InstalledServer[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Command</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Autostart</TableHead>
          <TableHead className="w-0"><span className="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {servers.map((server) => (
          <TableRow key={server.id}>
            <TableCell className="font-medium">{server.name}</TableCell>
            <TableCell className="max-w-80 truncate font-mono text-xs text-muted-foreground">
              {[server.launch.command, ...server.launch.args].join(" ")}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{server.source === "custom" ? "Custom" : "Catalog"}</Badge>
            </TableCell>
            <TableCell>{server.autostart ? "On" : "Off"}</TableCell>
            <TableCell>
              <RemoveServerButton server={server} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
