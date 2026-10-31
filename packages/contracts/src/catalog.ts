import { z } from "zod";

import { ServerName } from "./server";

export const CATALOG_MIN_QUERY = 3;

export const CatalogRunner = z.enum(["npx", "uvx", "docker", "remote"]);
export type CatalogRunner = z.infer<typeof CatalogRunner>;

export const CatalogInput = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  kind: z.enum(["text", "flag"]),
  required: z.boolean(),
  secret: z.boolean(),
  default: z.string().nullable(),
  choices: z.array(z.string()).nullable(),
  placeholder: z.string().nullable()
});
export type CatalogInput = z.infer<typeof CatalogInput>;

export const CatalogEntry = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  version: z.string(),
  runner: CatalogRunner,
  repositoryUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  deprecated: z.string().nullable(),
  defaultName: z.string(),
  inputs: z.array(CatalogInput),
  command: z.string()
});
export type CatalogEntry = z.infer<typeof CatalogEntry>;

export const CatalogSearch = z.object({
  query: z.string().trim().min(CATALOG_MIN_QUERY, `Type at least ${CATALOG_MIN_QUERY} characters to search.`),
  cursor: z.string().optional()
});
export type CatalogSearch = z.infer<typeof CatalogSearch>;

export const CatalogResults = z.object({ entries: z.array(CatalogEntry), nextCursor: z.string().nullable() });
export type CatalogResults = z.infer<typeof CatalogResults>;

export const CatalogInstall = z.object({
  registryName: z.string().min(1),
  version: z.string().min(1),
  name: ServerName,
  values: z.record(z.string(), z.string()).default({}),
  autostart: z.boolean().default(true)
});
export type CatalogInstall = z.infer<typeof CatalogInstall>;

export const CatalogUpdate = z.object({
  id: z.uuid(),
  version: z.string().min(1),
  values: z.record(z.string(), z.string()).optional()
});
export type CatalogUpdate = z.infer<typeof CatalogUpdate>;

export const AvailableUpdate = z.object({
  serverId: z.uuid(),
  from: z.string(),
  entry: CatalogEntry,
  inputsChanged: z.boolean()
});
export type AvailableUpdate = z.infer<typeof AvailableUpdate>;

// A value that was never sent falls back to the default; a sent "" clears it.
export const inputValue = (input: CatalogInput, values: Record<string, string>) =>
  (values[input.id] ?? input.default ?? "").trim();

export function inputErrors(inputs: CatalogInput[], values: Record<string, string>) {
  const errors: Record<string, string> = {};

  for (const input of inputs) {
    if (input.kind === "flag") continue;

    const value = inputValue(input, values);
    if (!value && input.required) errors[input.id] = `Enter a value for ${input.label}`;
    else if (value && input.choices && !input.choices.includes(value)) {
      errors[input.id] = `Choose one of: ${input.choices.join(", ")}`;
    }
  }

  return errors;
}

// The variable or header an `env:NAME` / `header:NAME` input sets on its own; inputs inside a templated value have none.
export const storedName = (input: CatalogInput) =>
  input.id === `env:${input.label}` || input.id === `header:${input.label}` ? input.label : null;

// A secret the server already keeps in the keychain under the name this input sets.
export function isStoredSecret(input: CatalogInput, names: string[]) {
  const name = storedName(input);
  return input.secret && name !== null && names.includes(name);
}
