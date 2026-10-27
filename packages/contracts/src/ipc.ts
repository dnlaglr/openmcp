import { z } from "zod";

import { ServerConfig, ServerName } from "./server";
import { ClientId, ClientInfo } from "./clients";

export const ipc = {
  "clients:list": { input: z.void(), output: z.array(ClientInfo) },
  "clients:getServers": { input: z.object({ client: ClientId }), output: z.record(z.string(), ServerConfig) },
  "clients:setServer": { input: z.object({ client: ClientId, name: ServerName, server: ServerConfig }), output: z.void() },
  "clients:removeServer": { input: z.object({ client: ClientId, name: z.string().min(1) }), output: z.void() }
} as const;

export type IpcChannel = keyof typeof ipc;
export type IpcInput<C extends IpcChannel> = z.input<(typeof ipc)[C]["input"]>;
export type IpcOutput<C extends IpcChannel> = z.output<(typeof ipc)[C]["output"]>;
