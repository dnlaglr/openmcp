import { z } from "zod";

// The parts of the registry's server.json that OpenMCP reads. Unknown fields are dropped, not rejected.
const RegistryInput = z.object({
  description: z.string().optional(),
  isRequired: z.boolean().optional(),
  isSecret: z.boolean().optional(),
  format: z.string().optional(),
  default: z.string().optional(),
  placeholder: z.string().optional(),
  choices: z.array(z.string()).nullish(),
  value: z.string().optional()
});
export type RegistryInput = z.infer<typeof RegistryInput>;

const Variables = z.record(z.string(), RegistryInput).nullish();

export const RegistryArgument = RegistryInput.extend({
  type: z.string(),
  name: z.string().optional(),
  valueHint: z.string().optional(),
  variables: Variables
});
export type RegistryArgument = z.infer<typeof RegistryArgument>;

export const RegistryEnvVar = RegistryInput.extend({ name: z.string(), variables: Variables });
export type RegistryEnvVar = z.infer<typeof RegistryEnvVar>;

export const RegistryPackage = z.object({
  registryType: z.string(),
  identifier: z.string(),
  version: z.string().optional(),
  transport: z.object({ type: z.string() }),
  runtimeArguments: z.array(RegistryArgument).nullish(),
  packageArguments: z.array(RegistryArgument).nullish(),
  environmentVariables: z.array(RegistryEnvVar).nullish()
});
export type RegistryPackage = z.infer<typeof RegistryPackage>;

export const RegistryRemote = z.object({
  type: z.string(),
  url: z.string(),
  variables: Variables,
  headers: z.array(RegistryEnvVar).nullish()
});
export type RegistryRemote = z.infer<typeof RegistryRemote>;

export const RegistryServer = z.object({
  name: z.string(),
  title: z.string().optional(),
  description: z.string(),
  version: z.string(),
  websiteUrl: z.string().optional(),
  repository: z.object({ url: z.string().optional() }).nullish(),
  packages: z.array(RegistryPackage).nullish(),
  remotes: z.array(RegistryRemote).nullish()
});
export type RegistryServer = z.infer<typeof RegistryServer>;

const Official = z.object({ status: z.string(), statusMessage: z.string().optional() });

export const RegistryEntry = z.object({
  server: RegistryServer,
  _meta: z.object({ "io.modelcontextprotocol.registry/official": Official.optional() }).optional()
});
export type RegistryEntry = z.infer<typeof RegistryEntry>;

export const RegistryList = z.object({
  servers: z.array(z.unknown()).nullable(),
  metadata: z.object({ nextCursor: z.string().optional() })
});
