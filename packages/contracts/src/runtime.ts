import { ImplementationSchema, PromptSchema, ResourceSchema, ToolSchema } from "@modelcontextprotocol/core";
import { z } from "zod";

export const MAX_LOG_LINES = 500;

export const ServerStatus = z.enum(["stopped", "starting", "running", "error", "signin"]);
export type ServerStatus = z.infer<typeof ServerStatus>;

export const ServerState = z.object({
  id: z.uuid(),
  status: ServerStatus,
  error: z.string().nullable(),
  restarts: z.number().int().nonnegative(),
  pid: z.number().int().nullable(),
  startedAt: z.date().nullable()
});
export type ServerState = z.infer<typeof ServerState>;

export const LogLine = z.object({
  serverId: z.uuid(),
  at: z.date(),
  source: z.enum(["stderr", "openmcp"]),
  text: z.string()
});
export type LogLine = z.infer<typeof LogLine>;

export type Tool = z.infer<typeof ToolSchema>;
export type Prompt = z.infer<typeof PromptSchema>;
export type Resource = z.infer<typeof ResourceSchema>;

export const ServerDetails = z.object({
  info: ImplementationSchema.nullable(),
  protocolVersion: z.string().nullable(),
  instructions: z.string().nullable(),
  tools: z.array(ToolSchema).nullable(),
  prompts: z.array(PromptSchema).nullable(),
  resources: z.array(ResourceSchema).nullable()
});
export type ServerDetails = z.infer<typeof ServerDetails>;
