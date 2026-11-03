import { z } from "zod";

export const Appearance = z.enum(["system", "light", "dark"]);
export type Appearance = z.infer<typeof Appearance>;

export const AppPage = z.enum(["servers", "agents", "activity", "catalog", "settings"]);
export type AppPage = z.infer<typeof AppPage>;

export const UpdateState = z.object({
  status: z.enum(["idle", "downloading", "ready", "manual"]),
  version: z.string().nullable(),
  percent: z.number(),
  notes: z.array(z.string()),
  releasedAt: z.date().nullable()
});
export type UpdateState = z.infer<typeof UpdateState>;
