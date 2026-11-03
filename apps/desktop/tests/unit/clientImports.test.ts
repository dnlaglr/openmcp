import { expect, test } from "vitest";

import { against, importable, planImport } from "../../src/main/clients/imports";

const github = {
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-github"],
  env: { GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_x", LOG_LEVEL: "info" }
};

test("moves secret-looking variables to the keychain and starts with OpenMCP", () => {
  expect(importable("github", github)).toEqual({
    name: "github",
    serverName: "github",
    type: "stdio",
    summary: "npx -y @modelcontextprotocol/server-github",
    reason: null,
    input: {
      type: "stdio",
      name: "github",
      autostart: true,
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { LOG_LEVEL: "info" },
      secrets: { GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_x" }
    }
  });
});

test("maps VS Code's typed remote entry and Codex's http_headers", () => {
  const vscode = {
    type: "http",
    url: "https://mcp.linear.app/mcp",
    headers: { Authorization: "Bearer t", "X-Team": "a" }
  };
  expect(importable("linear", vscode)).toMatchObject({
    type: "http",
    summary: "https://mcp.linear.app/mcp",
    input: { url: "https://mcp.linear.app/mcp", headers: { "X-Team": "a" }, secrets: { Authorization: "Bearer t" } }
  });

  const codex = { url: "https://mcp.linear.app/mcp", http_headers: { Authorization: "Bearer t" } };
  expect(importable("linear", codex).input).toMatchObject({ type: "http", secrets: { Authorization: "Bearer t" } });
});

test("names a server after the last part of a key OpenMCP can't use as a name", () => {
  expect(importable("io.github.upstash/context7", { command: "npx" })).toMatchObject({
    name: "io.github.upstash/context7",
    serverName: "context7",
    input: { name: "context7" }
  });
  expect(importable("my server.v2", { command: "npx" }).serverName).toBe("my-server-v2");
});

test("keeps a server the agent had turned off stopped", () => {
  expect(importable("fs", { command: "npx", enabled: false }).input?.autostart).toBe(false);
  expect(importable("fs", { command: "npx", disabled: true }).input?.autostart).toBe(false);
});

test.each([
  [{ type: "sse", url: "https://x.dev/sse" }, "OpenMCP doesn't support the older SSE transport."],
  [{ type: "ws", url: "wss://x.dev" }, "OpenMCP doesn't support ws servers."],
  [{ args: ["x"] }, "It has no command or URL."],
  ["npx", "It has no command or URL."],
  [
    { command: "node", args: ["${workspaceFolder}/server.js"] },
    "It uses ${…} placeholders, which OpenMCP can't fill in."
  ],
  [
    { url: "https://x.dev/mcp", headers: { Authorization: "Bearer ${input:token}" } },
    "It uses ${…} placeholders, which OpenMCP can't fill in."
  ],
  [{ command: "node", cwd: "/srv" }, `OpenMCP doesn't support its "cwd" setting.`],
  [{ command: "node", envFile: ".env" }, `OpenMCP doesn't support its "envFile" setting.`],
  [
    { url: "https://x.dev/mcp", bearer_token_env_var: "TOKEN" },
    `OpenMCP doesn't support its "bearer_token_env_var" setting.`
  ],
  [{ url: "http://example.com/mcp" }, "Use https:// (http:// only works for localhost)"]
])("can't import %o", (config, reason) => {
  expect(importable("x", config)).toMatchObject({ reason, input: null });
});

const stored = [{ id: "1", name: "github" }];
const resolved = { type: "stdio" as const, command: "npx", args: github.args, env: { ...github.env } };

test("marks an entry OpenMCP already runs the same way, secrets included", () => {
  expect(against(importable("github", github), stored, () => resolved)).toMatchObject({ existing: true, reason: null });
  expect(against(importable("memory", github), stored, () => resolved)).toMatchObject({
    existing: false,
    reason: null
  });
});

test("refuses an entry whose name OpenMCP already uses for a different server", () => {
  const otherToken = { ...resolved, env: { ...resolved.env, GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_y" } };
  const missingSecret = () => {
    throw new Error("The secret is missing from your keychain.");
  };

  for (const launchOf of [() => otherToken, missingSecret])
    expect(against(importable("github", github), stored, launchOf)).toEqual(
      expect.objectContaining({
        existing: false,
        input: null,
        reason: `OpenMCP already has a different server named "github". Rename one of them to import it.`
      })
    );
});

const fresh = (name: string, config: unknown) => against(importable(name, config), [], () => resolved);

test("imports a server found in several agents once", () => {
  const plan = planImport([
    { client: "Cursor", entry: fresh("github", github) },
    { client: "Claude Code", entry: fresh("github", { ...github, type: "stdio", disabled: true }) },
    { client: "Cursor", entry: fresh("memory", { command: "npx" }) }
  ]);

  expect(plan.names).toEqual(["github", "memory"]);
  expect(plan.create.map(({ name, autostart }) => ({ name, autostart }))).toEqual([
    { name: "github", autostart: true },
    { name: "memory", autostart: true }
  ]);
});

test("doesn't create a server OpenMCP already has", () => {
  const plan = planImport([{ client: "Cursor", entry: against(importable("github", github), stored, () => resolved) }]);
  expect(plan).toEqual({ names: ["github"], create: [] });
});

test("refuses servers that share a name but differ, or can't be imported", () => {
  expect(() =>
    planImport([
      { client: "Cursor", entry: fresh("github", github) },
      { client: "VS Code", entry: fresh("github", { command: "docker" }) }
    ])
  ).toThrow(`The servers named "github" in Cursor and VS Code differ. Import one of them.`);

  expect(() => planImport([{ client: "Cursor", entry: fresh("x", { type: "sse", url: "https://x.dev" }) }])).toThrow(
    `Can't import "x" from Cursor. OpenMCP doesn't support the older SSE transport.`
  );
});
