import { z } from "zod";

import { InstalledServer, NewCustomServer } from "./server";

export const ipc = {
  "app:version": { input: z.void(), output: z.string() },

  "servers:list": { input: z.void(), output: z.array(InstalledServer) },
  "servers:addCustom": { input: NewCustomServer, output: InstalledServer },
  "servers:remove": { input: z.object({ id: z.uuid() }), output: z.void() }
} as const;

export type IpcChannel = keyof typeof ipc;
export type IpcInput<C extends IpcChannel> = z.input<(typeof ipc)[C]["input"]>;
export type IpcHandlerInput<C extends IpcChannel> = z.output<(typeof ipc)[C]["input"]>;
export type IpcOutput<C extends IpcChannel> = z.output<(typeof ipc)[C]["output"]>;

export const ipcEvents = {
  "servers:changed": z.void()
} as const;

export type IpcEvent = keyof typeof ipcEvents;
export type IpcEventPayload<E extends IpcEvent> = z.output<(typeof ipcEvents)[E]>;

export const updaterChannels = { choice: "updater:choice", status: "updater:status" } as const;

export type UpdateStatus =
  | { state: "downloading"; percent: number; }
  | { state: "installing"; };

export type Api = {
  invoke: <C extends IpcChannel>(
    channel: C,
    ...input: IpcInput<C> extends void ? [] : [IpcInput<C>]
  ) => Promise<IpcOutput<C>>;
  on: <E extends IpcEvent>(event: E, callback: (payload: IpcEventPayload<E>) => void) => () => void;
};

export type UpdaterApi = {
  choose: (choice: "update" | "continue") => void;
  onStatus: (callback: (status: UpdateStatus) => void) => void;
};
