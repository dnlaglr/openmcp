import { z } from "zod";

export const ServerName = z.string().regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, - or _");
export type ServerName = z.infer<typeof ServerName>;

export const EnvName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use letters, numbers or _, not starting with a number");
export type EnvName = z.infer<typeof EnvName>;

export const Transport = z.enum(["stdio", "http", "sse"]);
export type Transport = z.infer<typeof Transport>;

const StringMap = z.record(z.string(), z.string());
const EnvMap = z.record(EnvName, z.string());

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

export const LaunchSpec = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: EnvMap.default({}),
  secretEnv: z.array(EnvName).default([])
});
export type LaunchSpec = z.infer<typeof LaunchSpec>;

export const ServerSource = z.enum(["registry", "custom"]);
export type ServerSource = z.infer<typeof ServerSource>;

export const InstalledServer = z.object({
  id: z.uuid(),
  name: ServerName,
  source: ServerSource,
  registryName: z.string().nullable(),
  version: z.string().nullable(),
  launch: LaunchSpec,
  autostart: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type InstalledServer = z.infer<typeof InstalledServer>;

export const NewCustomServer = z.object({
  name: ServerName,
  command: z.string().trim().min(1),
  args: z.array(z.string()).default([]),
  env: EnvMap.default({}),
  secrets: EnvMap.default({}),
  autostart: z.boolean().default(false)
}).refine(
  (server) => Object.keys(server.env).every((key) => !Object.hasOwn(server.secrets, key)),
  { error: "A variable can't be both plain and secret", path: ["secrets"] }
);
export type NewCustomServer = z.infer<typeof NewCustomServer>;
