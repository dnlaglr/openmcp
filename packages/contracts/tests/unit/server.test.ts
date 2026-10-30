import { describe, expect, it } from "vitest";

import { LaunchSpec, NewCustomServer, ServerName, ServerUpdate } from "../../src";

describe("NewCustomServer", () => {
  it("fills in defaults and trims the command", () => {
    expect(NewCustomServer.parse({ name: "everything", command: " npx " })).toEqual({
      name: "everything",
      command: "npx",
      args: [],
      env: {},
      secrets: {},
      autostart: false
    });
  });

  it("rejects a blank command", () => {
    expect(NewCustomServer.safeParse({ name: "everything", command: "   " }).success).toBe(false);
  });

  it("rejects env var names a shell can't use", () => {
    expect(NewCustomServer.safeParse({ name: "x", command: "npx", env: { "1BAD": "v" } }).success).toBe(false);
    expect(NewCustomServer.safeParse({ name: "x", command: "npx", secrets: { "API-KEY": "v" } }).success).toBe(false);
  });

  it("rejects a variable that is both plain and secret, flagging the secrets field", () => {
    const result = NewCustomServer.safeParse({
      name: "x",
      command: "npx",
      env: { API_KEY: "a" },
      secrets: { API_KEY: "b" }
    });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["secrets"]]);
  });

  it("rejects a whole command line in the command, pointing to the Arguments field", () => {
    const result = NewCustomServer.safeParse({ name: "x", command: "npx -y @modelcontextprotocol/server-everything" });

    expect(result.error?.issues).toMatchObject([
      { path: ["command"], message: "Put arguments in the Arguments field, one per line" }
    ]);
  });

  it("accepts a command path that contains spaces", () => {
    expect(NewCustomServer.safeParse({ name: "x", command: "C:\\Program Files\\nodejs\\node.exe" }).success).toBe(true);
    expect(NewCustomServer.safeParse({ name: "x", command: "/opt/My Tools/server" }).success).toBe(true);
  });
});

describe("LaunchSpec", () => {
  it("rejects invalid secret env names so the keyring never stores unusable keys", () => {
    expect(LaunchSpec.safeParse({ command: "npx", secretEnv: ["NOT-VALID"] }).success).toBe(false);
  });
});

describe("ServerName", () => {
  it("rejects names that break TOML bare keys", () => {
    expect(ServerName.safeParse("my-server_1").success).toBe(true);
    expect(ServerName.safeParse("my.server").success).toBe(false);
  });
});

describe("ServerUpdate", () => {
  const base = { id: "0b6e8d6c-3d1a-4c5e-9f2a-1b2c3d4e5f60", name: "x", command: "npx" };

  it("defaults keepSecrets to empty", () => {
    expect(ServerUpdate.parse(base).keepSecrets).toEqual({});
  });

  it("rejects a kept secret whose name is also a plain variable, flagging the secrets field", () => {
    const result = ServerUpdate.safeParse({ ...base, env: { API_KEY: "a" }, keepSecrets: { API_KEY: "API_KEY" } });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["secrets"]]);
  });

  it("rejects a kept name that isn't a usable env var name", () => {
    expect(ServerUpdate.safeParse({ ...base, keepSecrets: { "API-KEY": "API_KEY" } }).success).toBe(false);
  });
});
