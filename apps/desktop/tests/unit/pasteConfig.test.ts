import { expect, test } from "vitest";

import { parsePastedConfig } from "../../src/renderer/features/servers/pasteConfig";

const memory = {
  mcpServers: {
    memory: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-memory"],
      env: { MEMORY_FILE_PATH: "~/memory.json", API_KEY: "k" }
    }
  }
};

test("fills a local server from an mcpServers snippet", () => {
  const result = parsePastedConfig(JSON.stringify(memory));
  expect(result).toMatchObject({
    ok: true,
    skipped: 0,
    patch: { type: "stdio", name: "memory", command: "npx", args: "-y\n@modelcontextprotocol/server-memory" }
  });
  if (!result.ok) return;
  expect(result.patch.env?.map(({ key, value, secret }) => ({ key, value, secret }))).toEqual([
    { key: "MEMORY_FILE_PATH", value: "~/memory.json", secret: false },
    { key: "API_KEY", value: "k", secret: true }
  ]);
});

test("takes the first of several servers and says how many it skipped", () => {
  const many = { mcpServers: { a: { command: "a" }, b: { command: "b" }, c: { command: "c" } } };
  expect(parsePastedConfig(JSON.stringify(many))).toMatchObject({ ok: true, skipped: 2, patch: { name: "a" } });
});

test("fills a remote server from VS Code's servers key", () => {
  const remote = {
    servers: { linear: { type: "http", url: "https://mcp.linear.app/mcp", headers: { Authorization: "Bearer x" } } }
  };
  const result = parsePastedConfig(JSON.stringify(remote));
  expect(result).toMatchObject({
    ok: true,
    patch: { type: "http", name: "linear", url: "https://mcp.linear.app/mcp" }
  });
  if (result.ok) expect(result.patch.headers?.[0]).toMatchObject({ key: "Authorization", secret: true });
});

test("accepts a bare server object", () => {
  expect(parsePastedConfig('{ "command": "uvx", "args": ["mcp-server-git"] }')).toMatchObject({
    ok: true,
    patch: { type: "stdio", name: "", command: "uvx", args: "mcp-server-git" }
  });
});

test("splits a command line and guesses the name", () => {
  expect(parsePastedConfig("uvx mcp-server-fetch==2025.4.7")).toMatchObject({
    ok: true,
    patch: { type: "stdio", name: "fetch", command: "uvx", args: "mcp-server-fetch==2025.4.7" }
  });
  expect(parsePastedConfig('npx -y "@modelcontextprotocol/server-memory@2025.9.25"')).toMatchObject({
    ok: true,
    patch: { name: "memory", args: "-y\n@modelcontextprotocol/server-memory@2025.9.25" }
  });
});

test("refuses what it can't read", () => {
  expect(parsePastedConfig("")).toEqual({ ok: false, error: "Paste a config or a command line first." });
  const unreadable = { ok: false, error: "That isn’t a server config or a command line OpenMCP can read." };
  expect(parsePastedConfig("{ nope")).toEqual(unreadable);
  expect(parsePastedConfig('{ "mcpServers": {} }')).toEqual(unreadable);
  expect(parsePastedConfig('{ "name": "x" }')).toEqual(unreadable);
});
