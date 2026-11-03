import { z } from "zod";

import {
  ActivityBucket,
  ActivityEntry,
  ActivityQuery,
  ActivityScope,
  ActivitySummary,
  ActivitySummaryQuery
} from "./activity";
import { AvailableUpdate, CatalogEntry, CatalogInstall, CatalogResults, CatalogSearch, CatalogUpdate } from "./catalog";
import { LogLine, ServerCounts, ServerDetails, ServerState } from "./runtime";
import { ClientId, ClientImports, ClientState, ImportPick } from "./clients";
import { InstalledServer, NewCustomServer, ServerUpdate } from "./server";
import { GatewayConnection, GatewayPort, GatewayState } from "./gateway";
import { Appearance, AppPage, UpdateState } from "./app";
import { Runtimes } from "./system";

const ServerId = z.object({ id: z.uuid() });
const ClientTarget = z.object({ id: ClientId });

export const ipc = {
  "app:version": { input: z.void(), output: z.string() },
  "app:appearance": { input: z.void(), output: Appearance },
  "app:setAppearance": { input: Appearance, output: z.void() },

  "updater:state": { input: z.void(), output: UpdateState },
  "updater:install": { input: z.void(), output: z.void() },

  "servers:list": { input: z.void(), output: z.array(InstalledServer) },
  "servers:addCustom": { input: NewCustomServer, output: InstalledServer },
  "servers:update": { input: ServerUpdate, output: InstalledServer },
  "servers:remove": { input: ServerId, output: z.void() },
  "servers:setAutostart": { input: ServerId.extend({ autostart: z.boolean() }), output: z.void() },

  "servers:start": { input: ServerId, output: z.void() },
  "servers:stop": { input: ServerId, output: z.void() },
  "servers:restart": { input: ServerId, output: z.void() },
  "servers:states": { input: z.void(), output: z.array(ServerState) },
  "servers:counts": { input: z.void(), output: z.array(ServerCounts) },
  "servers:logs": { input: ServerId, output: z.array(LogLine) },
  "servers:details": { input: ServerId, output: ServerDetails },
  "servers:signIn": { input: ServerId, output: z.void() },
  "servers:signOut": { input: ServerId, output: z.void() },
  "servers:signedIn": { input: z.void(), output: z.array(z.uuid()) },

  "catalog:popular": { input: z.void(), output: z.array(CatalogEntry) },
  "catalog:search": { input: CatalogSearch, output: CatalogResults },
  "catalog:install": { input: CatalogInstall, output: InstalledServer },
  "catalog:updates": { input: z.void(), output: z.array(AvailableUpdate) },
  "catalog:update": { input: CatalogUpdate, output: InstalledServer },

  "gateway:state": { input: z.void(), output: GatewayState },
  "gateway:connection": { input: z.void(), output: GatewayConnection },
  "gateway:setPort": { input: z.object({ port: GatewayPort }), output: z.void() },
  "gateway:regenerateToken": { input: z.void(), output: GatewayConnection },

  "system:runtimes": { input: z.void(), output: Runtimes },

  "clients:list": { input: z.void(), output: z.array(ClientState) },
  "clients:connect": { input: ClientTarget, output: ClientState },
  "clients:disconnect": { input: ClientTarget, output: ClientState },
  "clients:reveal": { input: ClientTarget.extend({ target: z.enum(["config", "backups"]) }), output: z.void() },
  "clients:imports": { input: z.void(), output: z.array(ClientImports) },
  "clients:import": { input: z.object({ entries: z.array(ImportPick).min(1) }), output: z.array(z.string()) },

  "activity:summary": { input: ActivitySummaryQuery, output: ActivitySummary },
  "activity:series": { input: ActivityScope, output: z.array(ActivityBucket) },
  "activity:list": { input: ActivityQuery, output: z.array(ActivityEntry) }
} as const;

export type IpcChannel = keyof typeof ipc;
export type IpcInput<C extends IpcChannel> = z.input<(typeof ipc)[C]["input"]>;
export type IpcHandlerInput<C extends IpcChannel> = z.output<(typeof ipc)[C]["input"]>;
export type IpcOutput<C extends IpcChannel> = z.output<(typeof ipc)[C]["output"]>;

export const ipcEvents = {
  "servers:changed": z.void(),
  "servers:state": ServerState,
  "servers:counts": z.array(ServerCounts),
  "servers:log": LogLine,
  "gateway:state": GatewayState,
  "clients:changed": z.void(),
  "activity:changed": z.void(),
  "updater:state": UpdateState,
  "app:navigate": z.object({ page: AppPage, serverId: z.uuid().optional() })
} as const;

export type IpcEvent = keyof typeof ipcEvents;
export type IpcEventPayload<E extends IpcEvent> = z.output<(typeof ipcEvents)[E]>;

export type Api = {
  invoke: <C extends IpcChannel>(
    channel: C,
    ...input: IpcInput<C> extends void ? [] : [IpcInput<C>]
  ) => Promise<IpcOutput<C>>;
  on: <E extends IpcEvent>(event: E, callback: (payload: IpcEventPayload<E>) => void) => () => void;
};
