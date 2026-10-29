import { Server } from "lucide-react";

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { AddServerDialog } from "./AddServerDialog";
import { PageHeader } from "@/components/PageHeader";
import { ServerTable } from "./ServerTable";
import { ipcErrorMessage } from "@/lib/ipcError";
import { useServers } from "./useServers";

function ServersContent() {
  const { data: servers, error, isPending } = useServers();

  if (isPending) return null;
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {ipcErrorMessage(error)}
      </p>
    );
  if (servers.length > 0) return <ServerTable servers={servers} />;

  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Server />
        </EmptyMedia>
        <EmptyTitle>No servers yet</EmptyTitle>
        <EmptyDescription>Add a custom server by its command, or install one from the Catalog.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <AddServerDialog variant="outline" />
      </EmptyContent>
    </Empty>
  );
}

export function ServersPage() {
  return (
    <>
      <PageHeader title="MCP Servers" description="Servers installed on this machine." actions={<AddServerDialog />} />
      <ServersContent />
    </>
  );
}
