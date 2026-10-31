import { describe, expect, test } from "vitest";

import {
  CatalogInstall,
  CatalogSearch,
  inputErrors,
  inputValue,
  storedName,
  type CatalogInput
} from "../../src/catalog";

const input = (patch: Partial<CatalogInput> = {}): CatalogInput => ({
  id: "env:API_KEY",
  label: "API_KEY",
  description: null,
  kind: "text",
  required: false,
  secret: false,
  default: null,
  choices: null,
  placeholder: null,
  ...patch
});

describe("CatalogSearch", () => {
  test("trims the query and needs at least three characters", () => {
    expect(CatalogSearch.parse({ query: "  brave " })).toEqual({ query: "brave" });
    expect(CatalogSearch.safeParse({ query: " pl " }).success).toBe(false);
  });
});

describe("CatalogInstall", () => {
  test("defaults to no values and autostart on, and checks the local name", () => {
    const install = { registryName: "io.github.acme/acme", version: "1.0.0", name: "acme" };

    expect(CatalogInstall.parse(install)).toEqual({ ...install, values: {}, autostart: true });
    expect(CatalogInstall.safeParse({ ...install, name: "my server" }).success).toBe(false);
  });
});

describe("inputValue", () => {
  test("falls back to the default only when no value was sent, and trims", () => {
    const port = input({ default: "3030" });

    expect(inputValue(port, {})).toBe("3030");
    expect(inputValue(port, { "env:API_KEY": "" })).toBe("");
    expect(inputValue(port, { "env:API_KEY": "  8080\n" })).toBe("8080");
  });
});

describe("inputErrors", () => {
  test("asks for required values and known choices, and ignores flags", () => {
    const inputs = [
      input({ required: true }),
      input({ id: "env:REGION", label: "REGION", choices: ["eu", "us"] }),
      input({ id: "arg:0", label: "--read-only", kind: "flag", required: true })
    ];

    expect(inputErrors(inputs, { "env:REGION": "asia" })).toEqual({
      "env:API_KEY": "Enter a value for API_KEY",
      "env:REGION": "Choose one of: eu, us"
    });
    expect(inputErrors(inputs, { "env:API_KEY": "sk", "env:REGION": "eu" })).toEqual({});
  });
});

describe("storedName", () => {
  test("names env and header inputs that set a whole value, and not template parts", () => {
    expect(storedName(input())).toBe("API_KEY");
    expect(storedName(input({ id: "header:Authorization", label: "Authorization" }))).toBe("Authorization");
    expect(storedName(input({ id: "header:Authorization:token", label: "token" }))).toBeNull();
  });
});
