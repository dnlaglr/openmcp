import { z } from "zod";

export const Appearance = z.enum(["system", "light", "dark"]);
export type Appearance = z.infer<typeof Appearance>;
