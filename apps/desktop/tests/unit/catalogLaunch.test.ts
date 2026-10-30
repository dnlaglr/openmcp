import { describe, expect, test } from "vitest";

import type { RegistryEntry, RegistryPackage } from "@openmcp/contracts";

import { choosePlan, defaultServerName, toCatalogEntry } from "../../src/main/catalog/launch";

const npm = (extra: Partial<RegistryPackage> = {}): RegistryPackage => ({
  registryType: "npm",
  identifier: "@acme/server",
  version: "1.2.3",
  transport: { type: "stdio" },
  ...extra
});

const oci = (extra: Partial<RegistryPackage> = {}): RegistryPackage => ({
  registryType: "oci",
  identifier: "ghcr.io/acme/server",
  version: "1.2.3",
  transport: { type: "stdio" },
  ...extra
});

const server = (...packages: RegistryPackage[]) => ({
  name: "io.github.acme/acme-mcp",
  description: "Acme tools",
  version: "1.2.3",
  packages
});

function plan(pkg: RegistryPackage) {
  const result = choosePlan(server(pkg));
  if (!result) throw new Error("Expected an installable package");
  return result;
}

const entry = (extra: Partial<RegistryEntry["server"]> = {}, status = "active"): RegistryEntry => ({
  server: { ...server(npm()), ...extra },
  _meta: { "io.modelcontextprotocol.registry/official": { status } }
});

describe("choosePlan", () => {
  test("picks the first stdio package OpenMCP can run", () => {
    const picked = choosePlan(
      server(
        { registryType: "mcpb", identifier: "https://x/acme.mcpb", transport: { type: "stdio" } },
        npm({ transport: { type: "streamable-http" } }),
        { registryType: "pypi", identifier: "acme-server", version: "0.4.0", transport: { type: "stdio" } }
      )
    );

    expect(picked?.runner).toBe("uvx");
  });

  test("rejects servers with only remotes or unsupported packages", () => {
    expect(choosePlan({ ...server(), packages: undefined })).toBeNull();
    expect(choosePlan(server({ registryType: "cargo", identifier: "acme", transport: { type: "stdio" } }))).toBeNull();
  });

  test("rejects a package whose arguments carry a secret, since arguments are stored in plain text", () => {
    expect(
      choosePlan(server(npm({ packageArguments: [{ type: "named", name: "--token", isSecret: true }] })))
    ).toBeNull();
    expect(
      choosePlan(
        server(
          npm({
            packageArguments: [
              { type: "named", name: "--auth", value: "{token}", variables: { token: { isSecret: true } } }
            ]
          })
        )
      )
    ).toBeNull();
  });
});

describe("command lines", () => {
  test("pins npm packages behind npx -y", () => {
    expect(plan(npm()).build({})).toEqual({ command: "npx", args: ["-y", "@acme/server@1.2.3"], env: {}, secrets: {} });
  });

  test("pins pypi packages with uvx", () => {
    const pypi = { registryType: "pypi", identifier: "acme-server", version: "0.4.0", transport: { type: "stdio" } };
    expect(plan(pypi).build({}).args).toEqual(["acme-server==0.4.0"]);
  });

  test("puts runtime arguments before the package and package arguments after it", () => {
    const pkg = npm({
      runtimeArguments: [{ type: "positional", value: "--package" }],
      packageArguments: [{ type: "positional", value: "serve" }]
    });

    expect(plan(pkg).build({}).args).toEqual(["-y", "--package", "@acme/server@1.2.3", "serve"]);
  });

  test("runs oci images with docker, tagging untagged images and forwarding env by name", () => {
    const pkg = oci({
      environmentVariables: [
        { name: "API_KEY", isSecret: true, isRequired: true },
        { name: "REGION", default: "eu" }
      ]
    });

    expect(plan(pkg).build({ "env:API_KEY": "sk" })).toEqual({
      command: "docker",
      args: ["run", "-i", "--rm", "-e", "API_KEY", "-e", "REGION", "ghcr.io/acme/server:1.2.3"],
      env: { REGION: "eu" },
      secrets: { API_KEY: "sk" }
    });
  });

  test("keeps an image's own tag and treats a registry port as untagged", () => {
    expect(
      plan(oci({ identifier: "ghcr.io/acme/server:2.0.0" }))
        .build({})
        .args.at(-1)
    ).toBe("ghcr.io/acme/server:2.0.0");
    expect(
      plan(oci({ identifier: "localhost:5000/acme" }))
        .build({})
        .args.at(-1)
    ).toBe("localhost:5000/acme:1.2.3");
  });

  test("turns docker -e NAME=value arguments into forwarded env, so tokens reach the keychain", () => {
    const github = plan(
      oci({
        identifier: "ghcr.io/github/github-mcp-server:2.0.3",
        runtimeArguments: [
          { type: "named", name: "-p", value: "127.0.0.1:8085:8085" },
          { type: "named", name: "-e", value: "CALLBACK_PORT=8085" },
          { type: "named", name: "-e", value: "GITHUB_TOKEN={token}", variables: { token: { isSecret: true } } }
        ]
      })
    );

    expect(github.inputs).toMatchObject([
      { id: "env:GITHUB_TOKEN:token", label: "token", secret: true, required: false }
    ]);
    expect(github.build({ "env:GITHUB_TOKEN:token": "ghp_1" })).toEqual({
      command: "docker",
      args: [
        "run",
        "-i",
        "--rm",
        "-p",
        "127.0.0.1:8085:8085",
        "-e",
        "CALLBACK_PORT",
        "-e",
        "GITHUB_TOKEN",
        "ghcr.io/github/github-mcp-server:2.0.3"
      ],
      env: { CALLBACK_PORT: "8085" },
      secrets: { GITHUB_TOKEN: "ghp_1" }
    });
    expect(JSON.stringify(github.build({}))).not.toContain("GITHUB_TOKEN");
  });
});

describe("arguments", () => {
  const args = (packageArguments: RegistryPackage["packageArguments"]) => plan(npm({ packageArguments }));

  test("emits named arguments with a value as two tokens", () => {
    expect(
      args([{ type: "named", name: "--mode", value: "stdio" }])
        .build({})
        .args.slice(2)
    ).toEqual(["--mode", "stdio"]);
  });

  test("always emits an undescribed valueless named argument as a bare flag", () => {
    const stdio = args([{ type: "named", name: "--stdio" }]);

    expect(stdio.inputs).toEqual([]);
    expect(stdio.build({}).args.slice(2)).toEqual(["--stdio"]);
  });

  test("asks for a described valueless named argument and leaves it out when empty", () => {
    const atlas = args([{ type: "named", name: "--apiClientId", description: "Atlas API client ID" }]);

    expect(atlas.inputs).toMatchObject([{ id: "arg:0", label: "--apiClientId", kind: "text", required: false }]);
    expect(atlas.build({}).args.slice(2)).toEqual([]);
    expect(atlas.build({ "arg:0": "abc" }).args.slice(2)).toEqual(["--apiClientId", "abc"]);
  });

  test("offers boolean named arguments as switches, and always emits required ones", () => {
    const readOnly = args([{ type: "named", name: "--read-only", format: "boolean" }]);
    const required = args([{ type: "named", name: "--stdio", format: "boolean", isRequired: true }]);

    expect(readOnly.inputs).toMatchObject([{ id: "arg:0", kind: "flag" }]);
    expect(readOnly.build({ "arg:0": "true" }).args.slice(2)).toEqual(["--read-only"]);
    expect(readOnly.build({}).args.slice(2)).toEqual([]);
    expect(required.inputs).toEqual([]);
    expect(required.build({}).args.slice(2)).toEqual(["--stdio"]);
  });

  test("labels positional inputs with their value hint", () => {
    const db = args([{ type: "positional", valueHint: "database_url", isRequired: true }]);

    expect(db.inputs).toMatchObject([{ id: "arg:0", label: "database_url", required: true }]);
    expect(db.build({ "arg:0": "postgres://db" }).args.slice(2)).toEqual(["postgres://db"]);
  });

  test("uses the default when no value was sent, and leaves the argument out when it was cleared", () => {
    const port = args([{ type: "named", name: "--port", default: "3030" }]);

    expect(port.build({}).args.slice(2)).toEqual(["--port", "3030"]);
    expect(port.build({ "arg:0": "" }).args.slice(2)).toEqual([]);
  });

  test("fills {var} templates from their own inputs and drops the argument when one is empty", () => {
    const mount = args([
      {
        type: "named",
        name: "--mount",
        value: "type=bind,src={dir},dst=/data",
        variables: { dir: { isRequired: true, format: "filepath" } }
      }
    ]);

    expect(mount.inputs).toMatchObject([{ id: "arg:0:dir", label: "dir", required: true }]);
    expect(mount.build({ "arg:0:dir": "/home/me" }).args.slice(2)).toEqual([
      "--mount",
      "type=bind,src=/home/me,dst=/data"
    ]);
    expect(mount.build({}).args.slice(2)).toEqual([]);
  });
});

describe("environment variables", () => {
  test("sends secrets to the keychain, plain values to env, and sets fixed values without asking", () => {
    const pkg = npm({
      environmentVariables: [
        { name: "API_KEY", isSecret: true, isRequired: true },
        { name: "LOG", value: "debug" },
        { name: "OPTIONAL" }
      ]
    });

    expect(plan(pkg).inputs.map((input) => input.id)).toEqual(["env:API_KEY", "env:OPTIONAL"]);
    expect(plan(pkg).build({ "env:API_KEY": " sk-1\n" })).toMatchObject({
      env: { LOG: "debug" },
      secrets: { API_KEY: "sk-1" }
    });
  });

  test("inserts template values literally, even with $ sequences", () => {
    const pkg = npm({
      environmentVariables: [
        { name: "DB_URL", value: "postgres://app:{password}@db", variables: { password: { isSecret: true } } }
      ]
    });

    expect(plan(pkg).build({ "env:DB_URL:password": "pa$&s$1" }).secrets).toEqual({
      DB_URL: "postgres://app:pa$&s$1@db"
    });
  });
});

describe("toCatalogEntry", () => {
  test("describes an installable server with a command preview", () => {
    const pkg = npm({
      packageArguments: [{ type: "named", name: "--region", isRequired: true }],
      environmentVariables: [{ name: "API_KEY", isSecret: true, isRequired: true }]
    });

    expect(
      toCatalogEntry({
        ...entry({ title: "Acme", packages: [pkg], repository: { url: "https://github.com/acme/acme" } }, "deprecated"),
        _meta: { "io.modelcontextprotocol.registry/official": { status: "deprecated", statusMessage: "Use acme-2" } }
      })
    ).toEqual({
      name: "io.github.acme/acme-mcp",
      title: "Acme",
      description: "Acme tools",
      version: "1.2.3",
      runner: "npx",
      repositoryUrl: "https://github.com/acme/acme",
      websiteUrl: null,
      deprecated: "Use acme-2",
      defaultName: "acme",
      inputs: [expect.objectContaining({ id: "env:API_KEY" }), expect.objectContaining({ id: "arg:0" })],
      command: "npx -y @acme/server@1.2.3 --region ‹--region›"
    });
  });

  test("falls back to the name for the title and marks active servers as not deprecated", () => {
    expect(toCatalogEntry(entry())).toMatchObject({ title: "acme-mcp", deprecated: null });
  });

  test("drops links that aren't https", () => {
    const links = toCatalogEntry(entry({ repository: { url: "javascript:alert(1)" }, websiteUrl: "http://acme.dev" }));
    expect(links).toMatchObject({ repositoryUrl: null, websiteUrl: null });
  });

  test("returns null for servers OpenMCP can't run", () => {
    expect(toCatalogEntry(entry({ packages: [] }))).toBeNull();
  });
});

test.each([
  ["io.github.microsoft/playwright-mcp", "playwright"],
  ["com.supabase/mcp", "supabase"],
  ["io.github.github/github-mcp-server", "github"],
  ["io.github.upstash/context7", "context7"],
  ["io.github.acme/mcp-weather", "weather"],
  ["ai.acme/my.server", "my-server"]
])("defaultServerName(%s) is %s", (name, expected) => {
  expect(defaultServerName(name)).toBe(expected);
});
