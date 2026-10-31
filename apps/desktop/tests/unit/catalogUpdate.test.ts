import { beforeEach, expect, test, vi } from "vitest";

import { createDatabase, getServer, migrationsFolder, type Database } from "@openmcp/database";
import type { RegistryEnvVar } from "@openmcp/contracts";

const keyring = vi.hoisted(() => new Map<string, string>());

vi.mock("@openmcp/secrets", () => ({
  setSecret: (key: string, value: string) => keyring.set(key, value),
  getSecret: (key: string) => keyring.get(key) ?? null,
  deleteSecret: (key: string) => keyring.delete(key)
}));
vi.mock("../../src/main/ipc", () => ({ emit: () => {}, handle: () => {} }));

const { applyUpdate, findUpdates } = await import("../../src/main/catalog/handlers");
const { addCustomServer, saveServer } = await import("../../src/main/servers/servers");

const ACME = "io.github.test/acme";
const token: RegistryEnvVar = { name: "API_KEY", isRequired: true, isSecret: true };
const workspace: RegistryEnvVar = { name: "WORKSPACE", isRequired: true };

const short = (name: string) => name.split("/")[1];

const release = (name: string, version: string, environmentVariables = [token]) => ({
  server: {
    name,
    description: "A test server",
    version,
    packages: [
      { registryType: "npm", identifier: short(name), version, transport: { type: "stdio" }, environmentVariables }
    ]
  }
});

// Keyed by "name@version". A missing key is a 404, and an Error is a request that failed.
const registry = (replies: Record<string, unknown>) =>
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (url) => {
      const [, name = "", version = ""] = /\/servers\/([^/]+)\/versions\/([^/]+)$/.exec(String(url)) ?? [];
      const reply = replies[`${decodeURIComponent(name)}@${decodeURIComponent(version)}`];
      if (reply instanceof Error) throw reply;

      return reply ? Response.json(reply) : new Response("", { status: 404 });
    })
  );

type Stored = { args?: string[]; env?: Record<string, string>; secrets?: Record<string, string> };

// What installing `release(name, "1.0.0")` stores, plus any later edits.
const installed = (name: string, { args = [], env = {}, secrets = { API_KEY: "sk" } }: Stored = {}) =>
  saveServer(db, {
    name: short(name),
    source: "registry",
    registryName: name,
    version: "1.0.0",
    autostart: false,
    launch: { type: "stdio", command: "npx", args: ["-y", `${short(name)}@1.0.0`, ...args], env },
    secrets
  });

const key = (id: string, name: string) => `server:${id}:${name}`;

let db: Database;
beforeEach(() => {
  keyring.clear();
  db = createDatabase({ path: ":memory:", migrationsFolder });
});

test("finds a compatible update for each Catalog server", async () => {
  const acme = installed(ACME);
  addCustomServer(db, {
    type: "stdio",
    name: "custom",
    command: "node",
    args: [],
    env: {},
    secrets: {},
    autostart: false
  });
  registry({ [`${ACME}@1.0.0`]: release(ACME, "1.0.0"), [`${ACME}@latest`]: release(ACME, "1.1.0") });

  expect(await findUpdates(db)).toMatchObject([
    { serverId: acme.id, from: "1.0.0", entry: { name: ACME, version: "1.1.0" }, inputsChanged: false }
  ]);
});

test("leaves out servers that are current, unreachable or can't run their latest, and flags changed settings", async () => {
  const [acme] = ["acme", "beta", "gamma", "delta"].map((name) => installed(`io.github.test/${name}`));
  registry({
    [`${ACME}@1.0.0`]: release(ACME, "1.0.0"),
    [`${ACME}@latest`]: release(ACME, "1.1.0", [token, workspace]),
    "io.github.test/beta@latest": new Error("offline"),
    "io.github.test/gamma@latest": release("io.github.test/gamma", "1.0.0"),
    "io.github.test/delta@latest": { server: { ...release("io.github.test/delta", "2.0.0").server, packages: [] } }
  });

  expect(await findUpdates(db)).toMatchObject([
    { serverId: acme.id, entry: { version: "1.1.0" }, inputsChanged: true }
  ]);
});

test("swaps the pinned package and keeps the name, values, edits and secrets", async () => {
  const acme = installed(ACME, { args: ["--verbose"], env: { LOG_LEVEL: "debug" } });
  registry({ [`${ACME}@1.0.0`]: release(ACME, "1.0.0"), [`${ACME}@1.1.0`]: release(ACME, "1.1.0") });

  expect(await applyUpdate(db, { id: acme.id, version: "1.1.0" })).toMatchObject({
    id: acme.id,
    name: "acme",
    version: "1.1.0",
    launch: {
      command: "npx",
      args: ["-y", "acme@1.1.0", "--verbose"],
      env: { LOG_LEVEL: "debug" },
      secretEnv: ["API_KEY"]
    }
  });
  expect(keyring.get(key(acme.id, "API_KEY"))).toBe("sk");
});

test("refuses to swap when the settings changed, leaving the server as it was", async () => {
  const acme = installed(ACME);
  registry({
    [`${ACME}@1.0.0`]: release(ACME, "1.0.0"),
    [`${ACME}@1.1.0`]: release(ACME, "1.1.0", [token, workspace])
  });

  await expect(applyUpdate(db, { id: acme.id, version: "1.1.0" })).rejects.toThrow(
    "This update changes the server's settings. Open it again to review them."
  );
  expect(getServer(db, acme.id)?.version).toBe("1.0.0");
});

test("rebuilds from the form, keeping a blank stored secret and deleting a dropped one", async () => {
  const acme = installed(ACME, { secrets: { API_KEY: "sk", OLD_TOKEN: "old" } });
  registry({ [`${ACME}@1.1.0`]: release(ACME, "1.1.0", [token, workspace]) });

  const values = { "env:API_KEY": "", "env:WORKSPACE": "team" };
  expect(await applyUpdate(db, { id: acme.id, version: "1.1.0", values })).toMatchObject({
    version: "1.1.0",
    launch: { args: ["-y", "acme@1.1.0"], env: { WORKSPACE: "team" }, secretEnv: ["API_KEY"] }
  });
  expect(keyring.get(key(acme.id, "API_KEY"))).toBe("sk");
  expect(keyring.has(key(acme.id, "OLD_TOKEN"))).toBe(false);
});

test("asks for a new required value and a stored secret missing from the keychain", async () => {
  const acme = installed(ACME);
  registry({ [`${ACME}@1.1.0`]: release(ACME, "1.1.0", [token, workspace]) });

  await expect(applyUpdate(db, { id: acme.id, version: "1.1.0", values: { "env:API_KEY": "" } })).rejects.toThrow(
    "Enter a value for WORKSPACE"
  );

  keyring.delete(key(acme.id, "API_KEY"));
  const values = { "env:API_KEY": "", "env:WORKSPACE": "team" };
  await expect(applyUpdate(db, { id: acme.id, version: "1.1.0", values })).rejects.toThrow(
    "The secret API_KEY is missing from your keychain. Edit the server to set it again."
  );
  expect(getServer(db, acme.id)?.version).toBe("1.0.0");
});

test("explains a version the registry no longer has and refuses custom servers", async () => {
  const acme = installed(ACME);
  const custom = addCustomServer(db, {
    type: "stdio",
    name: "custom",
    command: "node",
    args: [],
    env: {},
    secrets: {},
    autostart: false
  });
  registry({});

  await expect(applyUpdate(db, { id: acme.id, version: "1.1.0" })).rejects.toThrow(
    "This version is no longer available. Open the Catalog again to get the latest one."
  );
  await expect(applyUpdate(db, { id: custom.id, version: "1.1.0" })).rejects.toThrow(
    "That server isn't from the Catalog."
  );
});

const HOSTED = "io.github.test/hosted";
const auth = { name: "Authorization", isRequired: true, isSecret: true };
const hostedRelease = (version: string, packages?: unknown[]) => ({
  server: {
    name: HOSTED,
    description: "A hosted test server",
    version,
    remotes: [{ type: "streamable-http", url: "https://mcp.test.dev/mcp", headers: [auth] }],
    packages
  }
});

test("updates a remote server in place and keeps it remote when the new version adds a package", async () => {
  const server = saveServer(db, {
    name: "hosted",
    source: "registry",
    registryName: HOSTED,
    version: "1.0.0",
    autostart: false,
    launch: { type: "http", url: "https://mcp.test.dev/mcp", headers: {} },
    secrets: { Authorization: "Bearer sk" }
  });
  const next = hostedRelease("1.1.0", [
    { registryType: "npm", identifier: "hosted", version: "1.1.0", transport: { type: "stdio" } }
  ]);
  registry({ [`${HOSTED}@1.0.0`]: hostedRelease("1.0.0"), [`${HOSTED}@latest`]: next, [`${HOSTED}@1.1.0`]: next });

  expect(await findUpdates(db)).toMatchObject([
    { serverId: server.id, entry: { runner: "remote" }, inputsChanged: false }
  ]);

  const updated = await applyUpdate(db, { id: server.id, version: "1.1.0" });
  expect(updated).toMatchObject({ version: "1.1.0", launch: server.launch });
  expect(keyring.get(key(server.id, "Authorization"))).toBe("Bearer sk");
});
