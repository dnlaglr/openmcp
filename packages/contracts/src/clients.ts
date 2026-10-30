import { z } from "zod";

export const ClientId = z.enum(["claude-desktop", "claude-code", "cursor", "vscode"]);
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
  hint: z.string().nullable()
});
export type ClientState = z.infer<typeof ClientState>;
