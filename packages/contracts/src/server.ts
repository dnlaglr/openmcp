import { z } from "zod";

export const ServerName = z.string().regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, - or _");
export type ServerName = z.infer<typeof ServerName>;

export const EnvName = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use letters, numbers or _, not starting with a number");
export type EnvName = z.infer<typeof EnvName>;

const EnvMap = z.record(EnvName, z.string(), {
  error: "Variable names use letters, numbers or _, and can't start with a number"
});

const HEADER_NAME = "Header names use letters, numbers and -, with no spaces or colons";

// An RFC 9110 token, so a name can't carry a colon, space or line break into a request.
export const HeaderName = z.string().regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/, HEADER_NAME);
export type HeaderName = z.infer<typeof HeaderName>;

const HeaderMap = z.record(HeaderName, z.string().regex(/^[^\r\n]*$/, "Header values can't contain line breaks"), {
  error: HEADER_NAME
});

// Matched on the text because this package has no URL global; only an explicit loopback host passes.
const LOOPBACK = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i;

// Headers carry keys, so plain http is only allowed when the request never leaves this machine.
export const RemoteUrl = z
  .url({ protocol: /^https?$/, error: "Enter a valid URL, like https://example.com/mcp" })
  .refine((url) => !/^http:/i.test(url) || LOOPBACK.test(url), "Use https:// (http:// only works for localhost)");

const StdioLaunch = z.object({
  type: z.literal("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: EnvMap.default({}),
  secretEnv: z.array(EnvName).default([])
});

const HttpLaunch = z.object({
  type: z.literal("http"),
  url: RemoteUrl,
  headers: HeaderMap.default({}),
  secretHeaders: z.array(HeaderName).default([])
});

export const LaunchSpec = z.discriminatedUnion("type", [StdioLaunch, HttpLaunch]);
export type LaunchSpec = z.infer<typeof LaunchSpec>;

export const secretNames = (launch: LaunchSpec) => (launch.type === "stdio" ? launch.secretEnv : launch.secretHeaders);

type Labelled = { type: "stdio"; command: string; args: string[] } | { type: "http"; url: string };

export const launchLabel = (launch: Labelled) =>
  launch.type === "http" ? launch.url : [launch.command, ...launch.args].join(" ");

export const ServerSource = z.enum(["registry", "custom"]);
export type ServerSource = z.infer<typeof ServerSource>;

export const InstalledServer = z.object({
  id: z.uuid(),
  name: ServerName,
  source: ServerSource,
  registryName: z.string().nullable(),
  version: z.string().nullable(),
  launch: LaunchSpec,
  autostart: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type InstalledServer = z.infer<typeof InstalledServer>;

const isCommandLine = (command: string) => /^[^\\/\s]+\s/.test(command);

const common = { name: ServerName, autostart: z.boolean().default(false) };

const StdioFields = z.object({
  ...common,
  type: z.literal("stdio"),
  command: z
    .string()
    .trim()
    .min(1, "Enter a command")
    .refine((command) => !isCommandLine(command), "Put arguments in the Arguments field, one per line"),
  args: z.array(z.string()).default([]),
  env: EnvMap.default({}),
  secrets: EnvMap.default({})
});

const HttpFields = z.object({
  ...common,
  type: z.literal("http"),
  url: RemoteUrl,
  headers: HeaderMap.default({}),
  secrets: HeaderMap.default({})
});

type Names = { secrets: object; keepSecrets?: object };

const distinct = (names: string[]) => new Set(names).size === names.length;
const namesOf = (...groups: object[]) => groups.flatMap((group) => Object.keys(group));

const distinctVariables = ({ env, secrets, keepSecrets = {} }: Names & { env: object }) =>
  distinct(namesOf(env, secrets, keepSecrets));

// HTTP header names ignore case, so Authorization and authorization are one header.
const distinctHeaders = ({ headers, secrets, keepSecrets = {} }: Names & { headers: object }) =>
  distinct(namesOf(headers, secrets, keepSecrets).map((name) => name.toLowerCase()));

const plainOrSecret = { error: "A variable can't be both plain and secret", path: ["secrets"] };
const oneHeader = { error: "Each header can only be set once", path: ["secrets"] };

export const NewCustomServer = z.discriminatedUnion("type", [
  StdioFields.refine(distinctVariables, plainOrSecret),
  HttpFields.refine(distinctHeaders, oneHeader)
]);
export type NewCustomServer = z.infer<typeof NewCustomServer>;

export const ServerUpdate = z.discriminatedUnion("type", [
  StdioFields.extend({ id: z.uuid(), keepSecrets: z.record(EnvName, EnvName).default({}) }).refine(
    distinctVariables,
    plainOrSecret
  ),
  HttpFields.extend({ id: z.uuid(), keepSecrets: z.record(HeaderName, HeaderName).default({}) }).refine(
    distinctHeaders,
    oneHeader
  )
]);
export type ServerUpdate = z.infer<typeof ServerUpdate>;
