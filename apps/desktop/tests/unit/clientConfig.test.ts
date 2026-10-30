import { expect, test } from "vitest";

import { readEntry, removeEntry, setEntry, statusOf } from "../../src/main/clients/config";

const entry = { url: "http://127.0.0.1:7465/mcp" };

test("adds the entry without touching comments or other servers", () => {
  const text = `{\n  // mine\n  "mcpServers": {\n    "other": { "command": "x" }\n  },\n  "theme": "dark"\n}\n`;
  const next = setEntry(text, "mcpServers", "openmcp", entry);

  expect(next).toContain("// mine");
  expect(next).toContain(`"other": { "command": "x" }`);
  expect(next).toContain(`"theme": "dark"`);
  expect(readEntry(next, "mcpServers", "openmcp")).toEqual({ entry });
});

test("creates the key in an empty or new file", () => {
  for (const text of ["", "{}"]) {
    expect(readEntry(setEntry(text, "servers", "openmcp", entry), "servers", "openmcp")).toEqual({ entry });
  }
});

test("replaces an outdated entry where it is", () => {
  const text = `{\n  "mcpServers": {\n    "openmcp": { "url": "old" },\n    "other": {}\n  }\n}\n`;
  const next = setEntry(text, "mcpServers", "openmcp", entry);

  expect(JSON.parse(next)).toEqual({ mcpServers: { openmcp: entry, other: {} } });
  expect(next.indexOf(`"openmcp"`)).toBeLessThan(next.indexOf(`"other"`));
});

test("keeps Windows line endings", () => {
  const next = setEntry(`{\r\n  "mcpServers": {}\r\n}\r\n`, "mcpServers", "openmcp", entry);

  expect(next.replaceAll("\r\n", "")).not.toContain("\n");
});

test("removes only the entry", () => {
  const text = setEntry(`{ "mcpServers": { "other": {} } }`, "mcpServers", "openmcp", entry);

  expect(JSON.parse(removeEntry(text, "mcpServers", "openmcp"))).toEqual({ mcpServers: { other: {} } });
});

test("leaves the text alone when there is nothing to remove", () => {
  for (const text of ["", "{}", `{ "mcpServers": {} }`]) expect(removeEntry(text, "mcpServers", "openmcp")).toBe(text);
});

test("accepts trailing commas", () => {
  expect(readEntry(`{ "servers": { "openmcp": ${JSON.stringify(entry)}, }, }`, "servers", "openmcp")).toEqual({
    entry
  });
});

test("reports the line of a syntax error", () => {
  const text = `{\n  "mcpServers": {\n    "a": 1\n    "b": 2\n  }\n}`;

  expect(readEntry(text, "mcpServers", "openmcp")).toEqual({ error: "Syntax error on line 4 (CommaExpected)." });
});

test("reports a file or key that isn't an object", () => {
  expect(readEntry("[]", "mcpServers", "openmcp")).toEqual({ error: "The file doesn't hold a JSON object." });
  expect(readEntry(`{ "mcpServers": null }`, "mcpServers", "openmcp")).toEqual({
    error: `"mcpServers" isn't a JSON object.`
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
  expect(statusOf({ ...input, key: "mcpServers", name: "openmcp", expected: entry }).status).toBe(status);
});
