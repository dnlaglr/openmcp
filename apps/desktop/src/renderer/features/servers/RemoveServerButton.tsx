import { Trash2 } from "lucide-react";

import type { InstalledServer } from "@openmcp/contracts";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useRemoveServer } from "./useServers";
import { ipcErrorMessage } from "@/lib/ipcError";
import { Button } from "@/components/ui/button";

export function RemoveServerButton({ server }: { server: InstalledServer }) {
  const removeServer = useRemoveServer();

  return (
    <AlertDialog onOpenChange={() => removeServer.reset()}>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Remove ${server.name}`} />}>
        <Trash2 />
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove '{server.name}'?</AlertDialogTitle>
          <AlertDialogDescription>This deletes the server and the secrets stored for it.</AlertDialogDescription>
        </AlertDialogHeader>

        {removeServer.error && (
          <p role="alert" className="text-sm text-destructive">
            {ipcErrorMessage(removeServer.error)}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={removeServer.isPending}
            onClick={() => removeServer.mutate(server.id)}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
