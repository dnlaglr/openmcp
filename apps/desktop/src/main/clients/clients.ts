import { join } from "node:path";

import type { ClientId, GatewayConnection } from "@openmcp/contracts";

export type ClientEnv = {
  platform: NodeJS.Platform;
  home: string;
  appData: string;
  localAppData: string | undefined;
  packages: string[];
  claudeConfigDir: string | undefined;
};

export type Location = { file: string; dir: string };
export type Bridge = { command: string; script: string };

export type ClientDefinition = {
  id: ClientId;
  name: string;
  key: "mcpServers" | "servers";
  hint: string | null;
  locate: (env: ClientEnv) => Location[];
  entry: (connection: GatewayConnection, bridge: Bridge) => Record<string, unknown>;
};

const at = (dir: string, file: string): Location => ({ file: join(dir, file), dir });

const http = ({ url, token }: GatewayConnection) => ({ url, headers: { Authorization: `Bearer ${token}` } });

function claudeDesktopDirs({ platform, appData, localAppData, packages }: ClientEnv) {
  const store =
    platform === "win32" && localAppData
      ? packages
          .filter((name) => name.startsWith("Claude_"))
          .map((name) => join(localAppData, "Packages", name, "LocalCache", "Roaming", "Claude"))
      : [];

  return [join(appData, "Claude"), ...store];
}

export const CLIENTS: ClientDefinition[] = [
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    key: "mcpServers",
    hint: "Restart Claude Desktop to apply.",
    locate: (env) => claudeDesktopDirs(env).map((dir) => at(dir, "claude_desktop_config.json")),
    entry: ({ url, token }, { command, script }) => ({
      command,
      args: [script],
      env: { ELECTRON_RUN_AS_NODE: "1", OPENMCP_URL: url, OPENMCP_TOKEN: token }
    })
  },
  {
    id: "claude-code",
    name: "Claude Code",
    key: "mcpServers",
    hint: "New Claude Code sessions pick this up.",
    locate: ({ home, claudeConfigDir }) => [
      { file: join(claudeConfigDir ?? home, ".claude.json"), dir: claudeConfigDir ?? join(home, ".claude") }
    ],
    entry: (connection) => ({ type: "http", ...http(connection) })
  },
  {
    id: "cursor",
    name: "Cursor",
    key: "mcpServers",
    hint: null,
    locate: ({ home }) => [at(join(home, ".cursor"), "mcp.json")],
    entry: http
  },
  {
    id: "vscode",
    name: "VS Code",
    key: "servers",
    hint: null,
    locate: ({ appData }) => [at(join(appData, "Code", "User"), "mcp.json")],
    entry: (connection) => ({ type: "http", ...http(connection) })
  }
];

export const entryName = (packaged: boolean) => (packaged ? "openmcp" : "openmcp-dev");

export const snippet = (client: ClientDefinition, name: string, entry: unknown) =>
  JSON.stringify({ [client.key]: { [name]: entry } }, null, 2);
