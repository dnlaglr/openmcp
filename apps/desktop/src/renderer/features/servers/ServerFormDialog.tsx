import { useState, type FormEvent, type ReactNode } from "react";
import type { UseMutationResult } from "@tanstack/react-query";

import type { NewCustomServer } from "@openmcp/contracts";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServerFormFields } from "./ServerFormFields";
import { ipcErrorMessage } from "@/lib/ipcError";
import { useServerForm } from "./useServerForm";
import { Button } from "@/components/ui/button";
import type { ServerForm } from "./serverForm";

type ServerFormDialogProps<T> = {
  trigger: ReactNode;
  title: string;
  description: string;
  submitLabel: string;
  initial: ServerForm;
  mutation: UseMutationResult<unknown, Error, T>;
  toInput: (server: NewCustomServer, form: ServerForm) => NoInfer<T>;
  // Only when adding: a saved server can't switch between a local command and a remote URL.
  chooseType?: boolean;
};

export function ServerFormDialog<T>({
  trigger,
  title,
  description,
  submitLabel,
  initial,
  mutation,
  toInput,
  chooseType = false
}: ServerFormDialogProps<T>) {
  const [open, setOpen] = useState(false);
  const serverForm = useServerForm();

  // Reset on open rather than close, so every open loads the latest saved server.
  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) return;

    serverForm.reset(initial);
    mutation.reset();
  }

  function change(patch: Partial<ServerForm>) {
    serverForm.update(patch);
    if (mutation.error) mutation.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();

    const server = serverForm.validate();
    if (server) mutation.mutate(toInput(server, serverForm.form), { onSuccess: () => setOpen(false) });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {trigger}

      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {chooseType && (
            <Tabs value={serverForm.form.type} onValueChange={(type: ServerForm["type"]) => change({ type })}>
              <TabsList className="w-full">
                <TabsTrigger value="stdio">Local command</TabsTrigger>
                <TabsTrigger value="http">Remote URL</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <ServerFormFields form={serverForm.form} errors={serverForm.errors} onChange={change} />

          {mutation.error && (
            <p role="alert" className="text-sm text-destructive">
              {ipcErrorMessage(mutation.error)}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
