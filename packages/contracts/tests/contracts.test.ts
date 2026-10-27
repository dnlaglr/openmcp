import { describe, expect, it } from "vitest";

import { CodexConfig, McpServersFile, ServerName } from "../src";

describe("contracts", () => {
  it("preserves unknown keys so writes don't drop user settings", () => {
    const raw = {
      theme: "dark",
      mcpServers: {
        fs: { command: "npx", args: ["-y", "fs"], disabled: true },
        remote: { url: "https://x.dev/mcp" }
      }
    };
    
    expect(McpServersFile.parse(raw)).toEqual(raw);
  });

  it("parses codex stdio and http servers", () => {
    const raw = {
      model: "gpt-5",
      mcp_servers: {
        fs: { command: "npx", enabled: true },
        api: { url: "https://x.dev/mcp", bearer_token_env_var: "TOKEN" }
      }
    };

    expect(CodexConfig.parse(raw)).toEqual(raw);
  });

  it("rejects names that break TOML bare keys", () => {
    expect(ServerName.safeParse("my-server_1").success).toBe(true);
    expect(ServerName.safeParse("my.server").success).toBe(false);
  });
});
