import { describe, expect, test } from "vitest";

import { emptyServerForm, parseServerForm, toNewCustomServer, type EnvRow } from "../../src/renderer/src/lib/server-form";

const row = (key: string, value: string, secret = false): EnvRow => ({ id: crypto.randomUUID(), key, value, secret });


describe("toNewCustomServer", () => {
  test("splits arguments by line, trimming and dropping blank lines", () => {
    const input = toNewCustomServer({ ...emptyServerForm, name: " github ", command: "npx", args: " -y \n\n@scope/server with space \n" });

    expect(input.name).toBe("github");
    expect(input.args).toEqual(["-y", "@scope/server with space"]);
  });

  test("sends secret rows as secrets, plain rows as env, and skips rows without a name", () => {
    const input = toNewCustomServer({
      ...emptyServerForm,
      env: [row("LOG_LEVEL", "debug"), row(" API_KEY ", "sk-123", true), row("  ", "ignored")]
    });

    expect(input.env).toEqual({ LOG_LEVEL: "debug" });
    expect(input.secrets).toEqual({ API_KEY: "sk-123" });
  });
});


describe("parseServerForm", () => {
  test("returns the parsed server when the form is valid", () => {
    const result = parseServerForm({ ...emptyServerForm, name: "fetch", command: "uvx", args: "mcp-server-fetch" });

    expect(result).toEqual({
      success: true,
      data: { name: "fetch", command: "uvx", args: ["mcp-server-fetch"], env: {}, secrets: {}, autostart: false }
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
});
