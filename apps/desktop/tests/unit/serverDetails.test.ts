import { describe, expect, test } from "vitest";

import {
  formatUptime,
  formValues,
  parseArguments,
  toolArguments,
  toolParameters
} from "../../src/renderer/features/servers/serverDetails";

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
      { name: "message", type: "string", required: true, description: "Text to echo", input: "text" },
      { name: "ids", type: "number[]", required: false, input: "json" },
      { name: "limit", type: "integer | null", required: false, input: "integer" },
      { name: "target", type: "string | boolean", required: false, input: "json" },
      { name: "anything", type: "any", required: false, input: "json" }
    ]);
  });

  test("returns nothing for a tool without parameters", () => {
    expect(toolParameters({ type: "object" })).toEqual([]);
  });

  test("picks a form input for each property, falling back to JSON for anything nested", () => {
    const parameters = toolParameters({
      type: "object",
      properties: {
        query: { type: "string" },
        ratio: { type: "number" },
        count: { type: "integer" },
        verbose: { type: "boolean" },
        mode: { type: "string", enum: ["fast", "slow"] },
        level: { enum: [1, 2, 3] },
        since: { anyOf: [{ type: "string" }, { type: "null" }] },
        tags: { type: "array", items: { type: "string" } },
        filter: { type: "object", properties: { name: { type: "string" } } },
        target: { oneOf: [{ type: "string" }, { type: "number" }] },
        shape: { enum: [{ kind: "circle" }] }
      }
    });

    expect(parameters.map(({ name, input, choices }) => ({ name, input, choices }))).toEqual([
      { name: "query", input: "text" },
      { name: "ratio", input: "number" },
      { name: "count", input: "integer" },
      { name: "verbose", input: "boolean" },
      { name: "mode", input: "enum", choices: ["fast", "slow"] },
      { name: "level", input: "enum", choices: [1, 2, 3] },
      { name: "since", input: "text" },
      { name: "tags", input: "json" },
      { name: "filter", input: "json" },
      { name: "target", input: "json" },
      { name: "shape", input: "json" }
    ]);
  });
});

describe("toolArguments", () => {
  const fields = toolParameters({
    type: "object",
    properties: {
      query: { type: "string" },
      ratio: { type: "number" },
      count: { type: "integer" },
      verbose: { type: "boolean" },
      strict: { type: "boolean" },
      level: { enum: [1, 2, 3] },
      tags: { type: "array", items: { type: "string" } }
    },
    required: ["query", "strict"]
  });

  test("turns each form value into its type", () => {
    const values = {
      query: "cats",
      ratio: "0.5",
      count: "3",
      verbose: "true",
      strict: "false",
      level: "2",
      tags: '["a", "b"]'
    };

    expect(toolArguments(fields, values)).toEqual({
      arguments: { query: "cats", ratio: 0.5, count: 3, verbose: true, strict: false, level: 2, tags: ["a", "b"] },
      errors: {}
    });
  });

  test("leaves out empty optional fields and sends an untouched required switch as off", () => {
    expect(toolArguments(fields, { query: "cats" })).toEqual({
      arguments: { query: "cats", strict: false },
      errors: {}
    });
  });

  test("flags empty required fields and values that don't parse", () => {
    const values = { query: "", ratio: "fast", count: "1.5", tags: "[oops" };

    expect(toolArguments(fields, values).errors).toEqual({
      query: "Enter a value.",
      ratio: "Enter a number.",
      count: "Enter a whole number.",
      tags: "Enter valid JSON."
    });
  });
});

describe("formValues", () => {
  test("turns arguments back into form values, leaving missing ones empty", () => {
    const fields = toolParameters({
      type: "object",
      properties: {
        query: { type: "string" },
        count: { type: "integer" },
        verbose: { type: "boolean" },
        level: { enum: [1, 2, 3] },
        filter: { type: "object" },
        note: { type: "string" }
      }
    });
    const values = formValues(fields, { query: "cats", count: 3, verbose: false, level: 2, filter: { a: 1 } });

    expect(values).toEqual({
      query: "cats",
      count: "3",
      verbose: "false",
      level: "2",
      filter: '{\n  "a": 1\n}',
      note: ""
    });
    expect(toolArguments(fields, values).arguments).toEqual({
      query: "cats",
      count: 3,
      verbose: false,
      level: 2,
      filter: { a: 1 }
    });
  });
});

describe("parseArguments", () => {
  test("accepts only a JSON object", () => {
    expect(parseArguments('{ "a": 1 }')).toEqual({ a: 1 });
    expect(parseArguments("[1]")).toBeNull();
    expect(parseArguments("{")).toBeNull();
  });
});
