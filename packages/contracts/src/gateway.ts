import { z } from "zod";

export const DEFAULT_GATEWAY_PORT = 7465;

const PORT_RANGE = "Use a port from 1024 to 65535";

export const GatewayPort = z.int(PORT_RANGE).min(1024, PORT_RANGE).max(65535, PORT_RANGE);

export const GatewayStatus = z.enum(["starting", "running", "error"]);
export type GatewayStatus = z.infer<typeof GatewayStatus>;

export const GatewayState = z.object({ status: GatewayStatus, port: z.int(), error: z.string().nullable() });
export type GatewayState = z.infer<typeof GatewayState>;

export const GatewayConnection = z.object({ url: z.string(), token: z.string() });
export type GatewayConnection = z.infer<typeof GatewayConnection>;

export const gatewayUrl = (port: number) => `http://127.0.0.1:${port}/mcp`;
