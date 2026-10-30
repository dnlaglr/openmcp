import { Pencil } from "lucide-react";

import type { InstalledServer, ServerState } from "@openmcp/contracts";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { keptSecrets, serverFormFrom } from "./serverForm";
import { DialogTrigger } from "@/components/ui/dialog";
import { ServerFormDialog } from "./ServerFormDialog";
import { Button } from "@/components/ui/button";
import { useUpdateServer } from "./useServers";

export function EditServerButton({ server, state }: { server: InstalledServer; state: ServerState }) {
  const updateServer = useUpdateServer();
  const active = state.status === "starting" || state.status === "running";
  const button = <Button variant="ghost" size="icon-sm" aria-label={`Edit ${server.name}`} />;

  return (
    <ServerFormDialog
      trigger={
        <Tooltip>
          <TooltipTrigger render={<DialogTrigger render={button} />}>
            <Pencil />
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
      }
      title={`Edit '${server.name}'`}
      description="Secret values stay in your OS keychain and aren't shown. Leave a stored secret blank to keep it."
      submitLabel={active ? "Save and restart" : "Save"}
      initial={serverFormFrom(server)}
      mutation={updateServer}
      toInput={(fields, form) => ({ id: server.id, ...fields, keepSecrets: keptSecrets(form) })}
    />
  );
}
