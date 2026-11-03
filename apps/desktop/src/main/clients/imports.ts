import { isDeepStrictEqual } from "node:util";

import {
  configServer,
  launchLabel,
  NewCustomServer,
  SECRET,
  type ConfigServer,
  type ImportEntry,
  type InstalledServer
} from "@openmcp/contracts";

import type { Launch } from "../servers/connection";

export type Candidate = ImportEntry & { input: NewCustomServer | null };
export type Picked = { client: string; entry: Candidate };

const TRANSPORTS = new Set([undefined, "stdio", "http", "streamable-http", "streamableHttp"]);
const UNSUPPORTED = ["cwd", "envFile", "env_vars", "bearer_token_env_var", "env_http_headers", "headersHelper"];

const listed = (names: string[]) => new Intl.ListFormat("en").format(names);

const record = (value: unknown) =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

function problemOf(config: Record<string, unknown>, server: ConfigServer | null) {
  const { type } = config;
  if (type === "sse") return "OpenMCP doesn't support the older SSE transport.";
  if (!TRANSPORTS.has(type as string)) return `OpenMCP doesn't support ${String(type)} servers.`;
  if (!server) return "It has no command or URL.";

  const key = UNSUPPORTED.find((name) => name in config);
  if (key) return `OpenMCP doesn't support its "${key}" setting.`;
  if (JSON.stringify(server).includes("${")) return "It uses ${…} placeholders, which OpenMCP can't fill in.";
  return null;
}

function split(values: Record<string, string>) {
  const entries = Object.entries(values);
  return [
    Object.fromEntries(entries.filter(([key]) => !SECRET.test(key))),
    Object.fromEntries(entries.filter(([key]) => SECRET.test(key)))
  ];
}

function inputOf(name: string, server: ConfigServer, config: Record<string, unknown>) {
  const autostart = config.enabled !== false && config.disabled !== true;
  if (server.type === "http") {
    const [headers, secrets] = split(server.headers);
    return { type: "http", name, autostart, url: server.url, headers, secrets };
  }

  const [env, secrets] = split(server.env);
  return { type: "stdio", name, autostart, command: server.command, args: server.args, env, secrets };
}

export function importable(name: string, value: unknown): Omit<Candidate, "existing"> {
  const config = record(value);
  const serverName = (name.split("/").at(-1) ?? "").replace(/[^A-Za-z0-9_-]/g, "-");
  const server = configServer(config);
  const base = { name, serverName, type: server?.type ?? null, summary: server ? launchLabel(server) : "" };

  const reason = problemOf(config, server);
  if (reason || !server) return { ...base, reason, input: null };

  const parsed = NewCustomServer.safeParse(inputOf(serverName, server, config));
  if (!parsed.success) return { ...base, reason: parsed.error.issues[0].message, input: null };
  return { ...base, reason: null, input: parsed.data };
}

function sameLaunch(launch: Launch, input: NewCustomServer) {
  if (input.type === "http")
    return (
      launch.type === "http" &&
      isDeepStrictEqual([launch.url, launch.headers], [input.url, { ...input.headers, ...input.secrets }])
    );

  return (
    launch.type === "stdio" &&
    isDeepStrictEqual(
      [launch.command, launch.args, launch.env],
      [input.command, input.args, { ...input.env, ...input.secrets }]
    )
  );
}

export function against(
  entry: Omit<Candidate, "existing">,
  servers: Pick<InstalledServer, "id" | "name">[],
  launchOf: (id: string) => Launch
): Candidate {
  const { input } = entry;
  const server = input && servers.find(({ name }) => name === input.name);
  if (!input || !server) return { ...entry, existing: false };

  let same = false;
  try {
    same = sameLaunch(launchOf(server.id), input);
  } catch {
    // A secret missing from the keychain can't match.
  }
  if (same) return { ...entry, existing: true };

  const reason = `OpenMCP already has a different server named "${server.name}". Rename one of them to import it.`;
  return { ...entry, existing: false, reason, input: null };
}

// Entries with one server name become one server; it's created unless OpenMCP already runs it.
export function planImport(picked: Picked[]) {
  const groups = new Map<string, Picked[]>();
  for (const pick of picked) {
    const { name, input, reason } = pick.entry;
    if (!input) throw new Error(`Can't import "${name}" from ${pick.client}. ${reason}`);
    groups.set(input.name, [...(groups.get(input.name) ?? []), pick]);
  }

  const create: NewCustomServer[] = [];
  for (const [name, group] of groups) {
    const inputs = group.map(({ entry }) => ({ ...entry.input!, autostart: false }));
    if (inputs.some((input) => !isDeepStrictEqual(input, inputs[0])))
      throw new Error(
        `The servers named "${name}" in ${listed([...new Set(group.map(({ client }) => client))])} differ. Import one of them.`
      );

    if (!group[0].entry.existing)
      create.push({ ...inputs[0], autostart: group.some(({ entry }) => entry.input!.autostart) });
  }

  return { names: [...groups.keys()], create };
}
