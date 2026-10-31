import { beforeEach, expect, test, vi } from "vitest";

import { createDatabase, listServers, migrationsFolder, type Database } from "@openmcp/database";

const keyring = vi.hoisted(() => new Map<string, string>());

vi.mock("@openmcp/secrets", () => ({
  setSecret: (key: string, value: string) => keyring.set(key, value),
  getSecret: (key: string) => keyring.get(key) ?? null,
  deleteSecret: (key: string) => keyring.delete(key)
}));
vi.mock("../../src/main/ipc", () => ({ emit: () => {}, handle: () => {} }));

const { installServer } = await import("../../src/main/catalog/handlers");

const brave = {
  server: {
    name: "io.github.brave/brave-search-mcp-server",
    title: "Brave Search",
    description: "Web search",
    version: "2.1.3",
    packages: [
      {
        registryType: "npm",
        identifier: "@brave/brave-search-mcp-server",
        version: "2.1.3",
        transport: { type: "stdio" },
        environmentVariables: [{ name: "BRAVE_API_KEY", isRequired: true, isSecret: true }]
      }
    ]
  }
};

const install = {
  registryName: brave.server.name,
  version: "2.1.3",
  name: "brave-search",
  values: { "env:BRAVE_API_KEY": "sk-brave-secret" },
  autostart: true
};

const registryReplies = (body: () => Response) =>
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () => body())
  );

let db: Database;
beforeEach(() => {
  keyring.clear();
  db = createDatabase({ path: ":memory:", migrationsFolder });
  registryReplies(() => Response.json(brave));
});

test("installs the registry's pinned launch and keeps the secret in the keyring", async () => {
  const server = await installServer(db, install);

  expect(server).toMatchObject({
    name: "brave-search",
    source: "registry",
    registryName: "io.github.brave/brave-search-mcp-server",
    version: "2.1.3",
    autostart: true,
    launch: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@brave/brave-search-mcp-server@2.1.3"],
      env: {},
      secretEnv: ["BRAVE_API_KEY"]
    }
  });
  expect(keyring.get(`server:${server.id}:BRAVE_API_KEY`)).toBe("sk-brave-secret");
  expect(JSON.stringify(db.$client.prepare("select * from installed_servers").all())).not.toContain("sk-brave-secret");
});

test("refuses to install the same registry server twice", async () => {
  await installServer(db, install);
  await expect(installServer(db, { ...install, name: "other" })).rejects.toThrow("Brave Search is already installed.");
});

test("refuses a missing required value without saving anything", async () => {
  await expect(installServer(db, { ...install, values: {} })).rejects.toThrow("Enter a value for BRAVE_API_KEY");
  expect(listServers(db)).toEqual([]);
  expect(keyring.size).toBe(0);
});

test("explains a version the registry no longer has", async () => {
  registryReplies(() => new Response("", { status: 404 }));
  await expect(installServer(db, install)).rejects.toThrow(
    "This version is no longer in the registry. Search again to get the latest one."
  );
});

test("refuses a server with nothing OpenMCP can run", async () => {
  registryReplies(() => Response.json({ server: { ...brave.server, packages: [] } }));
  await expect(installServer(db, install)).rejects.toThrow("This server has no package or remote OpenMCP can run.");
});

const hosted = (headers: unknown[], url = "https://mcp.acme.dev/mcp") => ({
  server: {
    name: "io.github.acme/hosted",
    description: "Hosted tools",
    version: "1.0.0",
    remotes: [{ type: "streamable-http", url, headers, variables: { tenant: { isRequired: true } } }]
  }
});
const installHosted = (values: Record<string, string>) =>
  installServer(db, {
    registryName: "io.github.acme/hosted",
    version: "1.0.0",
    name: "hosted",
    values,
    autostart: true
  });

test("installs a remote-only server with its secret header in the keyring", async () => {
  registryReplies(() =>
    Response.json(hosted([{ name: "Authorization", value: "Bearer {token}", isRequired: true, isSecret: true }]))
  );

  const server = await installHosted({ "header:Authorization:token": "sk" });

  expect(server.launch).toEqual({
    type: "http",
    url: "https://mcp.acme.dev/mcp",
    headers: {},
    secretHeaders: ["Authorization"]
  });
  expect(keyring.get(`server:${server.id}:Authorization`)).toBe("Bearer sk");
});

test("rejects a URL variable that doesn't make a valid URL and saves nothing", async () => {
  registryReplies(() => Response.json(hosted([], "https://{tenant}.acme.dev/mcp")));

  await expect(installHosted({ "url:tenant": "my tenant" })).rejects.toThrow(
    "Enter a valid URL, like https://example.com/mcp"
  );
  expect(listServers(db)).toEqual([]);
});

test("rejects a header the registry left unnamed and saves nothing", async () => {
  registryReplies(() => Response.json(hosted([{ name: "", isRequired: true, isSecret: true }])));

  await expect(installHosted({ "header:": "sk" })).rejects.toThrow(
    "Header names use letters, numbers and -, with no spaces or colons"
  );
  expect(listServers(db)).toEqual([]);
  expect(keyring.size).toBe(0);
});
