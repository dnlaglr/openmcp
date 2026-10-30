import { z } from "zod";

import { ActivityEntry, ActivityQuery, ActivityScope, ActivitySummary } from "./activity";
import { GatewayConnection, GatewayPort, GatewayState } from "./gateway";
import { LogLine, ServerDetails, ServerState } from "./runtime";
import { InstalledServer, NewCustomServer } from "./server";
import { ClientId, ClientState } from "./clients";

const ServerId = z.object({ id: z.uuid() });
const ClientTarget = z.object({ id: ClientId });

export const ipc = {
  "app:version": { input: z.void(), output: z.string() },

  "servers:list": { input: z.void(), output: z.array(InstalledServer) },
  "servers:addCustom": { input: NewCustomServer, output: InstalledServer },
  "servers:remove": { input: ServerId, output: z.void() },

  "servers:start": { input: ServerId, output: z.void() },
  "servers:stop": { input: ServerId, output: z.void() },
  "servers:restart": { input: ServerId, output: z.void() },
  "servers:states": { input: z.void(), output: z.array(ServerState) },
  "servers:logs": { input: ServerId, output: z.array(LogLine) },
  "servers:details": { input: ServerId, output: ServerDetails },

  "gateway:state": { input: z.void(), output: GatewayState },
  "gateway:connection": { input: z.void(), output: GatewayConnection },
  "gateway:setPort": { input: z.object({ port: GatewayPort }), output: z.void() },
  "gateway:regenerateToken": { input: z.void(), output: GatewayConnection },

  "clients:list": { input: z.void(), output: z.array(ClientState) },
  "clients:connect": { input: ClientTarget, output: ClientState },
  "clients:disconnect": { input: ClientTarget, output: ClientState },
  "clients:reveal": { input: ClientTarget.extend({ target: z.enum(["config", "backups"]) }), output: z.void() },

  "activity:summary": { input: ActivityScope, output: ActivitySummary },
  "activity:list": { input: ActivityQuery, output: z.array(ActivityEntry) }
} as const;

export type IpcChannel = keyof typeof ipc;
export type IpcInput<C extends IpcChannel> = z.input<(typeof ipc)[C]["input"]>;
export type IpcHandlerInput<C extends IpcChannel> = z.output<(typeof ipc)[C]["input"]>;
export type IpcOutput<C extends IpcChannel> = z.output<(typeof ipc)[C]["output"]>;

export const ipcEvents = {
  "servers:changed": z.void(),
  "servers:state": ServerState,
  "servers:log": LogLine,
  "gateway:state": GatewayState,
  "clients:changed": z.void(),
  "activity:changed": z.void()
} as const;

export type IpcEvent = keyof typeof ipcEvents;
export type IpcEventPayload<E extends IpcEvent> = z.output<(typeof ipcEvents)[E]>;

export const updaterChannels = { choice: "updater:choice", status: "updater:status" } as const;

export type UpdateStatus = { state: "downloading"; percent: number } | { state: "installing" };

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
