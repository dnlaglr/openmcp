import { z } from "zod";

import { Transport } from "./server";

export const ClientId = z.enum([
  "claude-desktop",
  "claude-code",
  "cursor",
  "vscode",
  "codex"
]);
export type ClientId = z.infer<typeof ClientId>;

export const ClientInfo = z.object({
  id: ClientId,
  name: z.string(),
  installed: z.boolean(),
  configPath: z.string(),
  transports: z.array(Transport)
});
export type ClientInfo = z.infer<typeof ClientInfo>;

const StringMap = z.record(z.string(), z.string());

const JsonStdioEntry = z.looseObject({
  type: z.literal("stdio").optional(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: StringMap.optional()
});

const JsonRemoteEntry = z.looseObject({
  type: z.enum(["http", "sse"]).optional(),
  url: z.string(),
  headers: StringMap.optional()
});

export const JsonServerEntry = z.union([ JsonStdioEntry, JsonRemoteEntry ]);
export type JsonServerEntry = z.infer<typeof JsonServerEntry>;

export const McpServersFile = z.looseObject({ mcpServers: z.record(z.string(), JsonServerEntry).optional() });
export type McpServersFile = z.infer<typeof McpServersFile>;

export const VsCodeMcpFile = z.looseObject({ servers: z.record(z.string(), JsonServerEntry).optional() });
export type VsCodeMcpFile = z.infer<typeof VsCodeMcpFile>;

export const CodexConfig = z.looseObject({
  mcp_servers: z.record(
    z.string(),
    z.union([
      z.looseObject({
        command: z.string(),
        args: z.array(z.string()).optional(),
        env: StringMap.optional()
      }),
      z.looseObject({
        url: z.string(),
        http_headers: StringMap.optional()
      })
    ])
  ).optional()
});
export type CodexConfig = z.infer<typeof CodexConfig>;
