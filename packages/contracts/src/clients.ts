import { z } from "zod";

export const ClientId = z.enum(["claude-desktop", "claude-code", "cursor", "vscode", "codex"]);
export type ClientId = z.infer<typeof ClientId>;

export const ClientStatus = z.enum(["missing", "disconnected", "connected", "outdated", "error"]);
export type ClientStatus = z.infer<typeof ClientStatus>;

export const ClientState = z.object({
  id: ClientId,
  name: z.string(),
  status: ClientStatus,
  path: z.string().nullable(),
  error: z.string().nullable(),
  snippet: z.string(),
  hint: z.string().nullable(),
  lastSeenAt: z.date().nullable(),
  backups: z.int().nonnegative()
});
export type ClientState = z.infer<typeof ClientState>;

export const ImportEntry = z.object({
  name: z.string(),
  serverName: z.string(),
  type: z.enum(["stdio", "http"]).nullable(),
  summary: z.string(),
  reason: z.string().nullable(),
  existing: z.boolean()
});
export type ImportEntry = z.infer<typeof ImportEntry>;

export const ClientImports = z.object({ id: ClientId, entries: z.array(ImportEntry) });
export type ClientImports = z.infer<typeof ClientImports>;

export const ImportPick = z.object({ id: ClientId, name: z.string() });
export type ImportPick = z.infer<typeof ImportPick>;

export const SECRET = /key|token|secret|password|auth/i;

export type ConfigServer =
  | { type: "stdio"; command: string; args: string[]; env: Record<string, string> }
  | { type: "http"; url: string; headers: Record<string, string> };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const strings = (record: unknown): Record<string, string> =>
  isObject(record) ? Object.fromEntries(Object.entries(record).map(([key, value]) => [key, String(value)])) : {};

// The entry shape every agent's config shares; only Codex names its headers http_headers.
export function configServer(config: unknown): ConfigServer | null {
  if (!isObject(config)) return null;
  if (typeof config.url === "string")
    return { type: "http", url: config.url, headers: strings(config.headers ?? config.http_headers) };
  if (typeof config.command !== "string") return null;

  const args = Array.isArray(config.args) ? config.args.map(String) : [];
  return { type: "stdio", command: config.command, args, env: strings(config.env) };
}

// The clientInfo.name each agent sends; Claude Desktop's comes through the bridge unchanged.
export const CLIENT_NAMES: Record<ClientId, RegExp> = {
  "claude-desktop": /^claude-ai$/i,
  "claude-code": /^claude-code$/i,
  cursor: /^cursor/i,
  vscode: /^visual studio code/i,
  codex: /^codex-mcp-client$/i
};
