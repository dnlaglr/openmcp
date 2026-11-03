import { expect, test } from "vitest";

import { readEntry, removeEntry, setEntry, statusOf } from "../../src/main/clients/config";

const entry = { url: "http://127.0.0.1:7465/mcp" };
const tomlEntry = { url: "http://127.0.0.1:7465/mcp", http_headers: { Authorization: "Bearer t0ken" } };
const codexConfig = `# mine\nmodel = "gpt-5"\n\n[mcp_servers.other]\ncommand = "x" # keep\n`;

test("adds the entry without touching comments or other servers", () => {
  const text = `{\n  // mine\n  "mcpServers": {\n    "other": { "command": "x" }\n  },\n  "theme": "dark"\n}\n`;
  const next = setEntry("json", text, "mcpServers", "openmcp", entry);

  expect(next).toContain("// mine");
  expect(next).toContain(`"other": { "command": "x" }`);
  expect(next).toContain(`"theme": "dark"`);
  expect(readEntry("json", next, "mcpServers", "openmcp")).toEqual({ entry });
});

test("creates the key in an empty or new file", () => {
  for (const text of ["", "{}"]) {
    expect(readEntry("json", setEntry("json", text, "servers", "openmcp", entry), "servers", "openmcp")).toEqual({
      entry
    });
  }
});

test("replaces an outdated entry where it is", () => {
  const text = `{\n  "mcpServers": {\n    "openmcp": { "url": "old" },\n    "other": {}\n  }\n}\n`;
  const next = setEntry("json", text, "mcpServers", "openmcp", entry);

  expect(JSON.parse(next)).toEqual({ mcpServers: { openmcp: entry, other: {} } });
  expect(next.indexOf(`"openmcp"`)).toBeLessThan(next.indexOf(`"other"`));
});

test("keeps Windows line endings", () => {
  const next = setEntry("json", `{\r\n  "mcpServers": {}\r\n}\r\n`, "mcpServers", "openmcp", entry);

  expect(next.replaceAll("\r\n", "")).not.toContain("\n");
});

test("removes only the entry", () => {
  const text = setEntry("json", `{ "mcpServers": { "other": {} } }`, "mcpServers", "openmcp", entry);

  expect(JSON.parse(removeEntry("json", text, "mcpServers", "openmcp"))).toEqual({ mcpServers: { other: {} } });
});

test("leaves the text alone when there is nothing to remove", () => {
  for (const text of ["", "{}", `{ "mcpServers": {} }`])
    expect(removeEntry("json", text, "mcpServers", "openmcp")).toBe(text);
});

test("accepts trailing commas", () => {
  expect(readEntry("json", `{ "servers": { "openmcp": ${JSON.stringify(entry)}, }, }`, "servers", "openmcp")).toEqual({
    entry
  });
});

test("reports the line of a syntax error", () => {
  const text = `{\n  "mcpServers": {\n    "a": 1\n    "b": 2\n  }\n}`;

  expect(readEntry("json", text, "mcpServers", "openmcp")).toEqual({
    error: "Syntax error on line 4 (CommaExpected)."
  });
});

test("reports a file or key that isn't an object", () => {
  expect(readEntry("json", "[]", "mcpServers", "openmcp")).toEqual({ error: "The file doesn't hold a JSON object." });
  expect(readEntry("json", `{ "mcpServers": null }`, "mcpServers", "openmcp")).toEqual({
    error: `"mcpServers" isn't a JSON object.`
  });
});

test("adds a TOML entry as its own table without touching comments or other servers", () => {
  const next = setEntry("toml", codexConfig, "mcp_servers", "openmcp", tomlEntry);

  expect(next).toBe(
    `${codexConfig}\n[mcp_servers.openmcp]\nurl = "http://127.0.0.1:7465/mcp"\nhttp_headers = { Authorization = "Bearer t0ken" }\n`
  );
  expect(readEntry("toml", next, "mcp_servers", "openmcp")).toEqual({ entry: tomlEntry });
});

test("creates the TOML table in an empty file, keeping Windows line endings", () => {
  expect(setEntry("toml", "", "mcp_servers", "openmcp", tomlEntry)).toBe(
    `[mcp_servers.openmcp]\nurl = "http://127.0.0.1:7465/mcp"\nhttp_headers = { Authorization = "Bearer t0ken" }\n`
  );

  const next = setEntry("toml", `model = "gpt-5"\r\n`, "mcp_servers", "openmcp", tomlEntry);
  expect(next.replaceAll("\r\n", "")).not.toContain("\n");
});

test("adds to an inline mcp_servers table, which can't take a table header", () => {
  const next = setEntry("toml", `mcp_servers = { other = { command = "x" } }\n`, "mcp_servers", "openmcp", tomlEntry);

  expect(readEntry("toml", next, "mcp_servers", "other")).toEqual({ entry: { command: "x" } });
  expect(readEntry("toml", next, "mcp_servers", "openmcp")).toEqual({ entry: tomlEntry });
});

test("replaces an outdated TOML entry where it is", () => {
  const text = `[mcp_servers.openmcp]\nurl = "old"\n\n[mcp_servers.other]\ncommand = "x"\n`;
  const next = setEntry("toml", text, "mcp_servers", "openmcp", tomlEntry);

  expect(readEntry("toml", next, "mcp_servers", "openmcp")).toEqual({ entry: tomlEntry });
  expect(next.indexOf("[mcp_servers.openmcp]")).toBeLessThan(next.indexOf("[mcp_servers.other]"));
});

test("removes only the TOML entry, leaving the file as it was", () => {
  const text = setEntry("toml", codexConfig, "mcp_servers", "openmcp", tomlEntry);

  expect(removeEntry("toml", text, "mcp_servers", "openmcp")).toBe(codexConfig);
  expect(removeEntry("toml", codexConfig, "mcp_servers", "openmcp")).toBe(codexConfig);
});

test("reports TOML syntax errors and an mcp_servers that isn't a table", () => {
  expect(readEntry("toml", `model = "gpt-5"\nmodel = "o3"\n`, "mcp_servers", "openmcp")).toEqual({
    error: "Syntax error on line 2 (Value already defined for model)."
  });
  expect(readEntry("toml", `mcp_servers = []\n`, "mcp_servers", "openmcp")).toEqual({
    error: `"mcp_servers" isn't a table.`
  });
});

test.each([
  [{ dirExists: false, text: null }, "missing"],
  [{ dirExists: true, text: null }, "disconnected"],
  [{ dirExists: true, text: "" }, "disconnected"],
  [{ dirExists: true, text: "{}" }, "disconnected"],
  [{ dirExists: true, text: "{" }, "error"],
  [{ dirExists: true, text: JSON.stringify({ mcpServers: { openmcp: entry } }) }, "connected"],
  [
    { dirExists: true, text: JSON.stringify({ mcpServers: { openmcp: { url: "http://127.0.0.1:1/mcp" } } }) },
    "outdated"
  ]
])("status of %o is %s", (input, status) => {
  expect(statusOf({ ...input, format: "json", key: "mcpServers", name: "openmcp", expected: entry }).status).toBe(
    status
  );
});

test("matches a TOML entry against the expected one", () => {
  const status = (text: string) =>
    statusOf({ format: "toml", dirExists: true, text, key: "mcp_servers", name: "openmcp", expected: tomlEntry })
      .status;

  expect(status(setEntry("toml", "", "mcp_servers", "openmcp", tomlEntry))).toBe("connected");
  expect(status(`[mcp_servers.openmcp]\nurl = "http://127.0.0.1:7465/mcp"\n`)).toBe("outdated");
  expect(status(`[mcp_servers`)).toBe("error");
});
