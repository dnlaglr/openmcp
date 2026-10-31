import { describe, expect, it } from "vitest";

import { launchLabel, LaunchSpec, NewCustomServer, secretNames, ServerName, ServerUpdate } from "../../src";

describe("NewCustomServer", () => {
  it("fills in defaults and trims the command", () => {
    expect(NewCustomServer.parse({ type: "stdio", name: "everything", command: " npx " })).toEqual({
      type: "stdio",
      name: "everything",
      command: "npx",
      args: [],
      env: {},
      secrets: {},
      autostart: false
    });
  });

  it("rejects a blank command", () => {
    expect(NewCustomServer.safeParse({ type: "stdio", name: "everything", command: "   " }).success).toBe(false);
  });

  it("rejects env var names a shell can't use", () => {
    expect(NewCustomServer.safeParse({ type: "stdio", name: "x", command: "npx", env: { "1BAD": "v" } }).success).toBe(
      false
    );
    expect(
      NewCustomServer.safeParse({ type: "stdio", name: "x", command: "npx", secrets: { "API-KEY": "v" } }).success
    ).toBe(false);
  });

  it("rejects a variable that is both plain and secret, flagging the secrets field", () => {
    const result = NewCustomServer.safeParse({
      type: "stdio",
      name: "x",
      command: "npx",
      env: { API_KEY: "a" },
      secrets: { API_KEY: "b" }
    });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["secrets"]]);
  });

  it("rejects a whole command line in the command, pointing to the Arguments field", () => {
    const result = NewCustomServer.safeParse({
      type: "stdio",
      name: "x",
      command: "npx -y @modelcontextprotocol/server-everything"
    });

    expect(result.error?.issues).toMatchObject([
      { path: ["command"], message: "Put arguments in the Arguments field, one per line" }
    ]);
  });

  it("accepts a command path that contains spaces", () => {
    expect(
      NewCustomServer.safeParse({ type: "stdio", name: "x", command: "C:\\Program Files\\nodejs\\node.exe" }).success
    ).toBe(true);
    expect(NewCustomServer.safeParse({ type: "stdio", name: "x", command: "/opt/My Tools/server" }).success).toBe(true);
  });
});

describe("LaunchSpec", () => {
  it("rejects invalid secret env names so the keyring never stores unusable keys", () => {
    expect(LaunchSpec.safeParse({ type: "stdio", command: "npx", secretEnv: ["NOT-VALID"] }).success).toBe(false);
  });
});

describe("ServerName", () => {
  it("rejects names that break TOML bare keys", () => {
    expect(ServerName.safeParse("my-server_1").success).toBe(true);
    expect(ServerName.safeParse("my.server").success).toBe(false);
  });
});

describe("ServerUpdate", () => {
  const base = { type: "stdio", id: "0b6e8d6c-3d1a-4c5e-9f2a-1b2c3d4e5f60", name: "x", command: "npx" };

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

describe("remote launches", () => {
  const remote = { type: "http", url: "https://mcp.example.com/mcp" };

  it("fills in headers and requires https except on this machine", () => {
    expect(LaunchSpec.parse(remote)).toEqual({ ...remote, headers: {}, secretHeaders: [] });
    for (const url of ["http://localhost:3000/mcp", "http://127.0.0.1:8080/mcp", "http://[::1]:8080/mcp"]) {
      expect(LaunchSpec.safeParse({ ...remote, url }).success).toBe(true);
    }
    expect(LaunchSpec.safeParse({ ...remote, url: "http://mcp.example.com/mcp" }).error?.issues[0].message).toBe(
      "Use https:// (http:// only works for localhost)"
    );
    for (const url of ["http://localhost.evil.com/mcp", "http://127.0.0.1.nip.io/mcp", "http://[::1].evil.com/mcp"]) {
      expect(LaunchSpec.safeParse({ ...remote, url }).success).toBe(false);
    }
    expect(LaunchSpec.safeParse({ ...remote, url: "https://my tenant.example.com/mcp" }).error?.issues[0].message).toBe(
      "Enter a valid URL, like https://example.com/mcp"
    );
    expect(LaunchSpec.safeParse({ ...remote, url: "ftp://mcp.example.com" }).success).toBe(false);
  });

  it("rejects header names that could break a request, and values with line breaks", () => {
    for (const name of ["X Key", "X-Key:", ""]) {
      expect(LaunchSpec.safeParse({ ...remote, headers: { [name]: "v" } }).error?.issues[0].message).toBe(
        "Header names use letters, numbers and -, with no spaces or colons"
      );
    }
    expect(LaunchSpec.safeParse({ ...remote, headers: { "X-Key": "sk\r\nX-Evil: 1" } }).error?.issues[0].message).toBe(
      "Header values can't contain line breaks"
    );
  });

  it("rejects a launch stored before launches had a type", () => {
    expect(LaunchSpec.safeParse({ command: "npx" }).success).toBe(false);
  });

  it("names a launch's secrets and labels it by command line or URL", () => {
    const stdio = LaunchSpec.parse({ type: "stdio", command: "npx", args: ["-y", "x"], secretEnv: ["API_KEY"] });
    const http = LaunchSpec.parse({ ...remote, secretHeaders: ["Authorization"] });

    expect([secretNames(stdio), secretNames(http)]).toEqual([["API_KEY"], ["Authorization"]]);
    expect([launchLabel(stdio), launchLabel(http)]).toEqual(["npx -y x", "https://mcp.example.com/mcp"]);
  });
});

describe("remote custom servers", () => {
  const base = { type: "http", name: "acme", url: "https://mcp.example.com/mcp" };

  it("fills in defaults", () => {
    expect(NewCustomServer.parse(base)).toEqual({ ...base, headers: {}, secrets: {}, autostart: false });
  });

  it("treats header names that differ only in case as the same header, flagging the secrets field", () => {
    const result = NewCustomServer.safeParse({
      ...base,
      headers: { Authorization: "a" },
      secrets: { authorization: "b" }
    });

    expect(result.error?.issues).toMatchObject([{ path: ["secrets"], message: "Each header can only be set once" }]);
  });

  it("keeps stored headers by header name", () => {
    const update = {
      ...base,
      id: "0b6e8d6c-3d1a-4c5e-9f2a-1b2c3d4e5f60",
      keepSecrets: { "X-Api-Key": "Authorization" }
    };

    expect(ServerUpdate.parse(update).keepSecrets).toEqual({ "X-Api-Key": "Authorization" });
    expect(ServerUpdate.safeParse({ ...update, keepSecrets: { "X Key": "Authorization" } }).success).toBe(false);
  });
});
