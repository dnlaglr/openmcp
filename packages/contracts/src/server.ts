import { z } from "zod";

export const ServerName = z.string().regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, - or _");
export type ServerName = z.infer<typeof ServerName>;

export const Transport = z.enum(["stdio", "http", "sse"]);
export type Transport = z.infer<typeof Transport>;

const StringMap = z.record(z.string(), z.string());

export const StdioServer = z.object({
  type: z.literal("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: StringMap.optional()
});

export const RemoteServer = z.object({
  type: z.enum(["http", "sse"]),
  url: z.url(),
  headers: StringMap.optional()
});

export const ServerConfig = z.discriminatedUnion("type", [ StdioServer, RemoteServer ]);
export type ServerConfig = z.infer<typeof ServerConfig>;
