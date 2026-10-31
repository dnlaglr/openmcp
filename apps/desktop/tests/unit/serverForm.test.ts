import { describe, expect, test } from "vitest";

import type { InstalledServer } from "@openmcp/contracts";

import {
  emptyServerForm,
  keptSecrets,
  newEnvRow,
  newHeaderRow,
  parseServerForm,
  serverFormFrom,
  toNewCustomServer,
  type EnvRow,
  type ServerForm
} from "../../src/renderer/features/servers/serverForm";

const row = (key: string, value: string, secret = false): EnvRow => ({
  id: crypto.randomUUID(),
  key,
  value,
  secret,
  stored: null
});

const installed: InstalledServer = {
  id: crypto.randomUUID(),
  name: "github",
  source: "registry",
  registryName: "io.github.github/github-mcp-server",
  version: "1.0.0",
  launch: {
    type: "stdio",
    command: "docker",
    args: ["run", "-i", "--rm", "-e", "GITHUB_TOKEN", "ghcr.io/github/github-mcp-server:1.0.0"],
    env: { LOG_LEVEL: "debug" },
    secretEnv: ["GITHUB_TOKEN"]
  },
  autostart: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

describe("toNewCustomServer", () => {
  test("splits arguments by line, trimming and dropping blank lines", () => {
    const input = toNewCustomServer({
      ...emptyServerForm,
      name: " github ",
      command: "npx",
      args: " -y \n\n@scope/server with space \n"
    });

    expect(input).toMatchObject({ name: "github", args: ["-y", "@scope/server with space"] });
  });

  test("sends secret rows as secrets, plain rows as env, and skips rows without a name", () => {
    const input = toNewCustomServer({
      ...emptyServerForm,
      env: [row("LOG_LEVEL", "debug"), row(" API_KEY ", "sk-123", true), row("  ", "ignored")]
    });

    expect(input).toMatchObject({ env: { LOG_LEVEL: "debug" }, secrets: { API_KEY: "sk-123" } });
  });
});

describe("parseServerForm", () => {
  test("returns the parsed server when the form is valid", () => {
    const result = parseServerForm({ ...emptyServerForm, name: "fetch", command: "uvx", args: "mcp-server-fetch" });

    expect(result).toEqual({
      success: true,
      data: {
        type: "stdio",
        name: "fetch",
        command: "uvx",
        args: ["mcp-server-fetch"],
        env: {},
        secrets: {},
        autostart: false
      }
    });
  });

  test("keeps the first message per top-level field", () => {
    const result = parseServerForm({ ...emptyServerForm, name: "bad name", command: " ", env: [row("1BAD", "v")] });

    expect(result).toEqual({
      success: false,
      errors: {
        name: "Use letters, numbers, - or _",
        command: "Enter a command",
        env: "Variable names use letters, numbers or _, and can't start with a number"
      }
    });
  });

  test("rejects a variable name used twice instead of silently dropping one", () => {
    const result = parseServerForm({
      ...emptyServerForm,
      name: "fetch",
      command: "uvx",
      env: [row("API_KEY", "one"), row(" API_KEY ", "two")]
    });

    expect(result).toEqual({ success: false, errors: { env: "Each variable name can only be used once" } });
  });

  test("asks for a value when a stored secret is switched to plain and left blank", () => {
    const form = serverFormFrom(installed);
    const result = parseServerForm({ ...form, env: [form.env[0], { ...form.env[1], secret: false }] });

    expect(result).toEqual({
      success: false,
      errors: { env: "Enter a value for GITHUB_TOKEN. Stored secrets aren't shown." }
    });
  });

  test("rejects a stored secret renamed to a name a shell can't use", () => {
    const form = serverFormFrom(installed);
    const result = parseServerForm({ ...form, env: [form.env[0], { ...form.env[1], key: "GITHUB-TOKEN" }] });

    expect(result).toEqual({
      success: false,
      errors: { env: "Variable names use letters, numbers or _, and can't start with a number" }
    });
  });
});

describe("serverFormFrom", () => {
  test("loads the launch with plain rows first and stored secrets left blank", () => {
    const form = serverFormFrom(installed);

    expect(form).toMatchObject({
      name: "github",
      command: "docker",
      args: "run\n-i\n--rm\n-e\nGITHUB_TOKEN\nghcr.io/github/github-mcp-server:1.0.0",
      autostart: true
    });
    expect(form.env).toMatchObject([
      { key: "LOG_LEVEL", value: "debug", secret: false, stored: null },
      { key: "GITHUB_TOKEN", value: "", secret: true, stored: "GITHUB_TOKEN" }
    ]);
  });

  test("round-trips an unchanged server, keeping its stored secret instead of sending it", () => {
    const form = serverFormFrom(installed);

    expect(toNewCustomServer(form)).toEqual({
      type: "stdio",
      name: "github",
      command: "docker",
      args: ["run", "-i", "--rm", "-e", "GITHUB_TOKEN", "ghcr.io/github/github-mcp-server:1.0.0"],
      env: { LOG_LEVEL: "debug" },
      secrets: {},
      autostart: true
    });
    expect(keptSecrets(form)).toEqual({ GITHUB_TOKEN: "GITHUB_TOKEN" });
  });
});

describe("keptSecrets", () => {
  const withSecretRow = (patch: Partial<EnvRow>) => {
    const form = serverFormFrom(installed);
    return { ...form, env: [form.env[0], { ...form.env[1], ...patch }] };
  };

  test("keeps a renamed stored secret under its trimmed new name", () => {
    expect(keptSecrets(withSecretRow({ key: " TOKEN " }))).toEqual({ TOKEN: "GITHUB_TOKEN" });
  });

  test("sends a typed value as a replacement instead of keeping the stored one", () => {
    const form = withSecretRow({ value: "ghp_new" });

    expect(keptSecrets(form)).toEqual({});
    expect(toNewCustomServer(form).secrets).toEqual({ GITHUB_TOKEN: "ghp_new" });
  });

  test("drops a stored secret whose name was cleared", () => {
    const form = withSecretRow({ key: "  " });

    expect(keptSecrets(form)).toEqual({});
    expect(toNewCustomServer(form).secrets).toEqual({});
  });

  test("ignores new secret rows", () => {
    const form = { ...emptyServerForm, env: [{ ...newEnvRow(), key: "API_KEY", secret: true }] };

    expect(keptSecrets(form)).toEqual({});
  });
});

describe("remote servers", () => {
  const remote: InstalledServer = {
    ...installed,
    source: "custom",
    registryName: null,
    version: null,
    launch: {
      type: "http",
      url: "https://mcp.example.com/mcp",
      headers: { "X-Region": "eu" },
      secretHeaders: ["Authorization"]
    }
  };
  const remoteForm = (patch: Partial<ServerForm>) => ({
    ...emptyServerForm,
    type: "http" as const,
    name: "acme",
    ...patch
  });

  test("sends secret and plain headers, trimming the URL and header values", () => {
    const form = remoteForm({
      url: " https://mcp.example.com/mcp ",
      headers: [row("Authorization", "Bearer sk\n", true), row("X-Region", " eu ")]
    });

    expect(parseServerForm(form)).toEqual({
      success: true,
      data: {
        type: "http",
        name: "acme",
        url: "https://mcp.example.com/mcp",
        headers: { "X-Region": "eu" },
        secrets: { Authorization: "Bearer sk" },
        autostart: false
      }
    });
  });

  test("rejects plain http to another machine", () => {
    expect(parseServerForm(remoteForm({ url: "http://mcp.example.com/mcp" }))).toEqual({
      success: false,
      errors: { url: "Use https:// (http:// only works for localhost)" }
    });
  });

  test("rejects the same header twice in any case", () => {
    const form = remoteForm({
      url: "https://mcp.example.com/mcp",
      headers: [row("Authorization", "a", true), row("authorization", "b")]
    });

    expect(parseServerForm(form)).toMatchObject({
      success: false,
      errors: { headers: "Each header can only be set once" }
    });
  });

  test("loads a remote server with its stored header blank and keeps it", () => {
    const form = serverFormFrom(remote);

    expect(form).toMatchObject({ type: "http", url: "https://mcp.example.com/mcp" });
    expect(form.headers).toMatchObject([
      { key: "X-Region", value: "eu", secret: false },
      { key: "Authorization", value: "", secret: true, stored: "Authorization" }
    ]);
    expect(keptSecrets(form)).toEqual({ Authorization: "Authorization" });
    expect(toNewCustomServer(form)).toEqual({
      type: "http",
      name: "github",
      url: "https://mcp.example.com/mcp",
      headers: { "X-Region": "eu" },
      secrets: {},
      autostart: true
    });
  });

  test("keeps both drafts when switching tabs and only sends the active one", () => {
    const form = { ...emptyServerForm, name: "x", command: "uvx", url: "https://mcp.example.com/mcp" };

    expect(toNewCustomServer({ ...form, type: "http" })).not.toHaveProperty("command");
    expect(toNewCustomServer(form)).toMatchObject({ type: "stdio", command: "uvx" });
  });

  test("starts new header rows as secrets", () => {
    expect(newHeaderRow()).toMatchObject({ key: "", value: "", secret: true, stored: null });
  });
});
