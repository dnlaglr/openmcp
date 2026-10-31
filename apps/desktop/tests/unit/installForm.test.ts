import { expect, test } from "vitest";

import type { CatalogEntry, CatalogInput, InstalledServer } from "@openmcp/contracts";

import {
  initialInstallForm,
  initialUpdateValues,
  installFormErrors,
  toInstallInput,
  updateFormErrors
} from "../../src/renderer/features/catalog/installForm";

const input = (patch: Partial<CatalogInput> & Pick<CatalogInput, "id" | "label">): CatalogInput => ({
  description: null,
  kind: "text",
  required: false,
  secret: false,
  default: null,
  choices: null,
  placeholder: null,
  ...patch
});

const entry: CatalogEntry = {
  name: "io.github.acme/acme-mcp",
  title: "Acme",
  description: "Acme tools",
  version: "1.2.3",
  runner: "npx",
  repositoryUrl: null,
  websiteUrl: null,
  deprecated: null,
  defaultName: "acme",
  command: "npx -y @acme/server@1.2.3",
  inputs: [
    input({ id: "env:API_KEY", label: "API_KEY", required: true, secret: true }),
    input({ id: "env:REGION", label: "REGION", default: "eu", choices: ["eu", "us"] }),
    input({ id: "arg:0", label: "--read-only", kind: "flag" })
  ]
};

test("starts from the suggested name, the defaults and autostart on", () => {
  expect(initialInstallForm(entry)).toEqual({
    name: "acme",
    values: { "env:API_KEY": "", "env:REGION": "eu", "arg:0": "" },
    autostart: true
  });
});

test("flags missing required values, unknown choices and invalid names", () => {
  const form = initialInstallForm(entry);

  expect(
    installFormErrors(entry, { ...form, name: "my server", values: { ...form.values, "env:REGION": "asia" } })
  ).toEqual({
    name: "Use letters, numbers, - or _",
    "env:API_KEY": "Enter a value for API_KEY",
    "env:REGION": "Choose one of: eu, us"
  });
});

test("accepts a filled form and sends the trimmed name with every value", () => {
  const form = {
    ...initialInstallForm(entry),
    name: " acme ",
    values: { "env:API_KEY": "sk", "env:REGION": "us", "arg:0": "true" }
  };

  expect(installFormErrors(entry, form)).toEqual({});
  expect(toInstallInput(entry, form)).toEqual({
    registryName: "io.github.acme/acme-mcp",
    version: "1.2.3",
    name: "acme",
    values: { "env:API_KEY": "sk", "env:REGION": "us", "arg:0": "true" },
    autostart: true
  });
});

const server: InstalledServer = {
  id: "4f8b6a3e-9c1d-4e2f-8a7b-1c2d3e4f5a6b",
  name: "acme",
  source: "registry",
  registryName: "io.github.acme/acme-mcp",
  version: "1.2.2",
  launch: { command: "npx", args: ["-y", "@acme/server@1.2.2"], env: { REGION: "us" }, secretEnv: ["API_KEY"] },
  autostart: true,
  createdAt: new Date(0),
  updatedAt: new Date(0)
};

test("prefills an update from the current launch and leaves the stored secret blank", () => {
  expect(initialUpdateValues(entry, server)).toEqual({ "env:API_KEY": "", "env:REGION": "us", "arg:0": "" });
});

test("lets a stored secret stay blank but asks for one that isn't stored", () => {
  const values = initialUpdateValues(entry, server);

  expect(updateFormErrors(entry, server, values)).toEqual({});
  expect(updateFormErrors(entry, { ...server, launch: { ...server.launch, secretEnv: [] } }, values)).toEqual({
    "env:API_KEY": "Enter a value for API_KEY"
  });
});
