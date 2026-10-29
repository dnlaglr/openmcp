import { useState, type ComponentProps, type FormEvent } from "react";
import { Plus } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { ServerFormFields } from "./ServerFormFields";
import { useAddCustomServer } from "./useServers";
import { ipcErrorMessage } from "@/lib/ipcError";
import { useServerForm } from "./useServerForm";
import { Button } from "@/components/ui/button";
import type { ServerForm } from "./serverForm";

export function AddServerDialog({ variant }: { variant?: ComponentProps<typeof Button>["variant"] }) {
  const [open, setOpen] = useState(false);
  const serverForm = useServerForm();
  const addServer = useAddCustomServer();

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) return;

    serverForm.reset();
    addServer.reset();
  }

  function change(patch: Partial<ServerForm>) {
    serverForm.update(patch);
    if (addServer.error) addServer.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();

    const server = serverForm.validate();
    if (server) addServer.mutate(server, { onSuccess: () => changeOpen(false) });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button variant={variant} />}>
        <Plus /> Add Server
      </DialogTrigger>

      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Add custom server</DialogTitle>
            <DialogDescription>
              Run any MCP server by its command. Secret values are stored securely in your OS keychain.
            </DialogDescription>
          </DialogHeader>

          <ServerFormFields form={serverForm.form} errors={serverForm.errors} onChange={change} />

          {addServer.error && (
            <p role="alert" className="text-sm text-destructive">
              {ipcErrorMessage(addServer.error)}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={addServer.isPending}>
              Add server
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
