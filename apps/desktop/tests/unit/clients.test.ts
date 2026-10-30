import { expect, test } from "vitest";
import { join } from "node:path";

import { CLIENTS, entryName, snippet, type ClientEnv } from "../../src/main/clients/clients";

const env: ClientEnv = {
  platform: "darwin",
  home: "/Users/ada",
  appData: "/Users/ada/Library/Application Support",
  localAppData: undefined,
  packages: ["Claude_pzs8sxrjxfjjc"],
  claudeConfigDir: undefined
};
const connection = { url: "http://127.0.0.1:7465/mcp", token: "t0ken" };
const bridge = { command: "/Applications/OpenMCP.app/Contents/MacOS/OpenMCP", script: "/app.asar/dist/main/bridge.js" };
const headers = { Authorization: "Bearer t0ken" };

const client = (id: string) => CLIENTS.find((candidate) => candidate.id === id)!;
const at = (dir: string, file: string) => ({ file: join(dir, file), dir });

test("finds each client's config under the user's folders", () => {
  expect(CLIENTS.map((candidate) => candidate.locate(env))).toEqual([
    [at(join(env.appData, "Claude"), "claude_desktop_config.json")],
    [{ file: join(env.home, ".claude.json"), dir: join(env.home, ".claude") }],
    [at(join(env.home, ".cursor"), "mcp.json")],
    [at(join(env.appData, "Code", "User"), "mcp.json")]
  ]);
});

test("also looks in the Windows Store copy of Claude Desktop's folder", () => {
  const windows: ClientEnv = {
    ...env,
    platform: "win32",
    appData: "C:\\Users\\ada\\AppData\\Roaming",
    localAppData: "C:\\Users\\ada\\AppData\\Local",
    packages: ["Microsoft.WindowsTerminal_8wekyb3d8bbwe", "Claude_pzs8sxrjxfjjc"]
  };
  const store = join(windows.localAppData!, "Packages", "Claude_pzs8sxrjxfjjc", "LocalCache", "Roaming", "Claude");

  expect(client("claude-desktop").locate(windows)).toEqual([
    at(join(windows.appData, "Claude"), "claude_desktop_config.json"),
    at(store, "claude_desktop_config.json")
  ]);
});

test("uses CLAUDE_CONFIG_DIR for Claude Code when it is set", () => {
  expect(client("claude-code").locate({ ...env, claudeConfigDir: "/tmp/claude" })).toEqual([
    { file: join("/tmp/claude", ".claude.json"), dir: "/tmp/claude" }
  ]);
});

test("points Claude Code, Cursor and VS Code at the gateway over http with the token", () => {
  expect(client("claude-code").entry(connection, bridge)).toEqual({ type: "http", url: connection.url, headers });
  expect(client("cursor").entry(connection, bridge)).toEqual({ url: connection.url, headers });
  expect(client("vscode").entry(connection, bridge)).toEqual({ type: "http", url: connection.url, headers });
});

test("runs the bridge with OpenMCP's own executable for Claude Desktop", () => {
  expect(client("claude-desktop").entry(connection, bridge)).toEqual({
    command: bridge.command,
    args: [bridge.script],
    env: { ELECTRON_RUN_AS_NODE: "1", OPENMCP_URL: connection.url, OPENMCP_TOKEN: "t0ken" }
  });
});

test("wraps the snippet in the client's own key", () => {
  expect(JSON.parse(snippet(client("vscode"), "openmcp", { a: 1 }))).toEqual({ servers: { openmcp: { a: 1 } } });
  expect(JSON.parse(snippet(client("cursor"), "openmcp", { a: 1 }))).toEqual({ mcpServers: { openmcp: { a: 1 } } });
});

test("names the entry openmcp-dev outside packaged builds", () => {
  expect(entryName(true)).toBe("openmcp");
  expect(entryName(false)).toBe("openmcp-dev");
});
