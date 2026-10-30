import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { ipcErrorMessage } from "@/lib/ipcError";
import { useClients } from "./useClients";
import { ClientRow } from "./ClientRow";

function ClientsContent() {
  const { data: clients, error, isPending } = useClients();

  if (isPending) return null;
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {ipcErrorMessage(error)}
      </p>
    );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Client</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Config</TableHead>
          <TableHead className="w-0">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {clients.map((client) => (
          <ClientRow key={client.id} client={client} />
        ))}
      </TableBody>
    </Table>
  );
}

export function ClientsPage() {
  return (
    <>
      <PageHeader title="Clients" description="Connect your AI apps to the OpenMCP gateway." />
      <ClientsContent />
    </>
  );
}
