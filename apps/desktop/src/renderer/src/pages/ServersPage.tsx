import { Plus } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

export function ServersPage() {
  return (
    <>
      <PageHeader title="MCP Servers" description="Servers installed on this machine." actions={<Button><Plus /> Add Server</Button>} />
    </>
  )
}
