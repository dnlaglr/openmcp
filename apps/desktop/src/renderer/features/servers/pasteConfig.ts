import { configServer, SECRET } from "@openmcp/contracts";

import { newEnvRow, newHeaderRow, type EnvRow, type ServerForm } from "./serverForm";

export type PasteResult = { ok: true; patch: Partial<ServerForm>; skipped: number } | { ok: false; error: string };

const EMPTY = "Paste a config or a command line first.";
const UNREADABLE = "That isn’t a server config or a command line OpenMCP can read.";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const rows = (record: Record<string, string>, make: () => EnvRow): EnvRow[] =>
  Object.entries(record).map(([key, value]) => ({ ...make(), key, value, secret: SECRET.test(key) }));

function fromServer(name: string, config: unknown): Partial<ServerForm> | null {
  const server = configServer(config);
  if (!server) return null;

  return server.type === "http"
    ? { type: "http", name, url: server.url, headers: rows(server.headers, newHeaderRow) }
    : { type: "stdio", name, command: server.command, args: server.args.join("\n"), env: rows(server.env, newEnvRow) };
}

// "@scope/server-memory@1.0" → "memory", "mcp-server-fetch==2025.4.7" → "fetch".
function guessName(words: string[]) {
  const last = words.findLast((word) => !word.startsWith("-")) ?? "";
  return (last.split("/").pop() ?? "")
    .replace(/(@|==).*$/, "")
    .replace(/^(mcp-server-|server-|mcp-)/, "")
    .replace(/-mcp$/, "")
    .replace(/[^A-Za-z0-9_-]/g, "-");
}

function parseJson(text: string): PasteResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: UNREADABLE };
  }
  if (!isObject(json)) return { ok: false, error: UNREADABLE };

  const group = isObject(json.mcpServers) ? json.mcpServers : isObject(json.servers) ? json.servers : null;
  const entries: [string, unknown][] = group ? Object.entries(group) : [["", json]];
  const [first] = entries;
  const patch = first ? fromServer(first[0], first[1]) : null;

  return patch ? { ok: true, patch, skipped: entries.length - 1 } : { ok: false, error: UNREADABLE };
}

export function parsePastedConfig(text: string): PasteResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: EMPTY };
  if (/^[[{]/.test(trimmed)) return parseJson(trimmed);

  const words = trimmed.split(/\s+/).map((word) => word.replace(/^(["'])(.*)\1$/, "$2"));
  const args = words.slice(1);
  return {
    ok: true,
    skipped: 0,
    patch: { type: "stdio", name: guessName(args), command: words[0], args: args.join("\n") }
  };
}
