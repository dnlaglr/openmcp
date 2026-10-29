import { describe, expect, test } from "vitest";

import { formatUptime, toolParameters } from "../../src/renderer/features/servers/serverDetails";

describe("formatUptime", () => {
  test.each([
    [0, "0s"],
    [12_000, "12s"],
    [252_000, "4m 12s"],
    [3_661_000, "1h 1m"],
    [90_000_000, "1d 1h"],
    [-500, "0s"]
  ])("formats %i ms as %s", (ms, text) => {
    expect(formatUptime(ms)).toBe(text);
  });
});

describe("toolParameters", () => {
  test("lists each property with its type, whether it's required, and its description", () => {
    const parameters = toolParameters({
      type: "object",
      properties: {
        message: { type: "string", description: "Text to echo" },
        ids: { type: "array", items: { type: "number" } },
        limit: { type: ["integer", "null"] },
        target: { anyOf: [{ type: "string" }, { type: "boolean" }] },
        anything: true
      },
      required: ["message"]
    });

    expect(parameters).toEqual([
      { name: "message", type: "string", required: true, description: "Text to echo" },
      { name: "ids", type: "number[]", required: false },
      { name: "limit", type: "integer | null", required: false },
      { name: "target", type: "string | boolean", required: false },
      { name: "anything", type: "any", required: false }
    ]);
  });

  test("returns nothing for a tool without parameters", () => {
    expect(toolParameters({ type: "object" })).toEqual([]);
  });
});
