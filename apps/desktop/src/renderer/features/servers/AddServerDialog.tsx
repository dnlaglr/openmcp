import type { ComponentProps } from "react";
import { Plus } from "lucide-react";

import { DialogTrigger } from "@/components/ui/dialog";
import { ServerFormDialog } from "./ServerFormDialog";
import { useAddCustomServer } from "./useServers";
import { Button } from "@/components/ui/button";
import { emptyServerForm } from "./serverForm";

export function AddServerDialog({ variant }: { variant?: ComponentProps<typeof Button>["variant"] }) {
  const addServer = useAddCustomServer();

  return (
    <ServerFormDialog
      trigger={
        <DialogTrigger render={<Button variant={variant} />}>
          <Plus /> Add Server
        </DialogTrigger>
      }
      title="Add custom server"
      description="Run a local command or connect to a remote server. Secret values are stored in your OS keychain."
      submitLabel="Add server"
      initial={emptyServerForm}
      mutation={addServer}
      toInput={(server) => server}
      chooseType
    />
  );
}
