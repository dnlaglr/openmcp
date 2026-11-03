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

// The clientInfo.name each agent sends; Claude Desktop's comes through the bridge unchanged.
export const CLIENT_NAMES: Record<ClientId, RegExp> = {
  "claude-desktop": /^claude-ai$/i,
  "claude-code": /^claude-code$/i,
  cursor: /^cursor/i,
  vscode: /^visual studio code/i,
  codex: /^codex-mcp-client$/i
};
