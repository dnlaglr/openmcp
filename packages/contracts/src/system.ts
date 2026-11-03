import { z } from "zod";

export const Runtime = z.object({ found: z.boolean(), version: z.string().nullable() });
export type Runtime = z.infer<typeof Runtime>;

export const Runtimes = z.object({ node: Runtime, uv: Runtime, docker: Runtime.extend({ running: z.boolean() }) });
export type Runtimes = z.infer<typeof Runtimes>;
