import { z } from "zod";

export const ipc = {
  "app:version": { input: z.void(), output: z.string() }
} as const;

export type IpcChannel = keyof typeof ipc;
export type IpcInput<C extends IpcChannel> = z.input<(typeof ipc)[C]["input"]>;
export type IpcHandlerInput<C extends IpcChannel> = z.output<(typeof ipc)[C]["input"]>;
export type IpcOutput<C extends IpcChannel> = z.output<(typeof ipc)[C]["output"]>;

export type UpdateStatus =
  | { state: "downloading"; percent: number; }
  | { state: "installing"; };

export type Api = {
  invoke: <C extends IpcChannel>(
    channel: C,
    ...input: IpcInput<C> extends void ? [] : [IpcInput<C>]
  ) => Promise<IpcOutput<C>>;
};

export type UpdaterApi = {
  choose: (choice: "update" | "continue") => void;
  onStatus: (callback: (status: UpdateStatus) => void) => void;
};
