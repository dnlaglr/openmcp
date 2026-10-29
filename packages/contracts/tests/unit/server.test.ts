import { describe, expect, it } from "vitest";

import { LaunchSpec, NewCustomServer , ServerName} from "../../src";

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
