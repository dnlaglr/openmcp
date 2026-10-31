import { beforeEach, expect, test, vi } from "vitest";
import { randomUUID } from "node:crypto";

import { createDatabase, listServers, migrationsFolder, type Database } from "@openmcp/database";
import type { InstalledServer, ServerUpdate } from "@openmcp/contracts";

const keyring = vi.hoisted(() => new Map<string, string>());

vi.mock("@openmcp/secrets", () => ({
  setSecret: (key: string, value: string) => {
    if (value === "fail") throw new Error("Keyring is locked");
    keyring.set(key, value);
  },
  getSecret: (key: string) => keyring.get(key) ?? null,
  deleteSecret: (key: string) => keyring.delete(key)
}));

const { addCustomServer, deleteServer, editServer, launchFor, saveServer } =
  await import("../../src/main/servers/servers");

let db: Database;
beforeEach(() => {
  keyring.clear();
  db = createDatabase({ path: ":memory:", migrationsFolder });
});

test("stores secret values in the keyring and only their names in the database", () => {
  const server = addCustomServer(db, {
    type: "stdio",
    name: "everything",
    command: "npx",
    args: ["-y", "server-everything"],
    env: { LOG_LEVEL: "debug" },
    secrets: { API_KEY: "sk-secret-value" },
    autostart: false
  });

  expect(server.launch).toEqual({
    type: "stdio",
    command: "npx",
    args: ["-y", "server-everything"],
    env: { LOG_LEVEL: "debug" },
    secretEnv: ["API_KEY"]
  });
  expect(keyring.get(`server:${server.id}:API_KEY`)).toBe("sk-secret-value");

  const rows = JSON.stringify(db.$client.prepare("select * from installed_servers").all());
  expect(rows).not.toContain("sk-secret-value");
});

test("rejects a duplicate name with a readable error", () => {
  const input = {
    type: "stdio" as const,
    name: "everything",
    command: "npx",
    args: [],
    env: {},
    secrets: {},
    autostart: false
  };
  addCustomServer(db, input);

  expect(() => addCustomServer(db, input)).toThrow('A server named "everything" already exists.');
});

test("removes already-stored secrets when a later one fails to save", () => {
  const input = {
    type: "stdio",
    name: "everything",
    command: "npx",
    args: [],
    env: {},
    secrets: { FIRST: "ok", SECOND: "fail" },
    autostart: false
  };

  expect(() => addCustomServer(db, input)).toThrow("Keyring is locked");
  expect(keyring.size).toBe(0);
  expect(listServers(db)).toEqual([]);
});

test("deletes a server's secrets when the server is removed", () => {
  const server = addCustomServer(db, {
    type: "stdio",
    name: "everything",
    command: "npx",
    args: [],
    env: {},
    secrets: { API_KEY: "sk" },
    autostart: false
  });

  deleteServer(db, server.id);

  expect(listServers(db)).toEqual([]);
  expect(keyring.size).toBe(0);
});

test("launches with plain env plus secrets read from the keyring", () => {
  const server = addCustomServer(db, {
    type: "stdio",
    name: "everything",
    command: "npx",
    args: ["-y", "server-everything"],
    env: { LOG_LEVEL: "debug" },
    secrets: { API_KEY: "sk-secret-value" },
    autostart: false
  });

  expect(launchFor(db, server.id)).toEqual({
    type: "stdio",
    command: "npx",
    args: ["-y", "server-everything"],
    env: { LOG_LEVEL: "debug", API_KEY: "sk-secret-value" }
  });
});

test("refuses to launch when a secret is missing from the keyring", () => {
  const server = addCustomServer(db, {
    type: "stdio",
    name: "everything",
    command: "npx",
    args: [],
    env: {},
    secrets: { API_KEY: "sk" },
    autostart: false
  });
  keyring.clear();

  expect(() => launchFor(db, server.id)).toThrow(
    "The secret API_KEY is missing from your keychain. Edit the server to set it again."
  );
});

test("refuses to launch a server that no longer exists", () => {
  expect(() => launchFor(db, randomUUID())).toThrow("That server no longer exists.");
});

const custom = (name = "everything", secrets: Record<string, string> = {}) =>
  addCustomServer(db, { type: "stdio", name, command: "npx", args: [], env: {}, secrets, autostart: false });

const edit = (server: InstalledServer, patch: Partial<ServerUpdate & { version: string }> = {}) =>
  editServer(db, {
    type: "stdio",
    id: server.id,
    name: server.name,
    command: "npx",
    args: [],
    env: {},
    secrets: {},
    keepSecrets: {},
    autostart: false,
    ...patch
  });

const key = (server: InstalledServer, name: string) => `server:${server.id}:${name}`;

test("replaces the name, launch and autostart, keeping the id", () => {
  const server = custom();
  const edited = edit(server, {
    name: "renamed",
    command: "uvx",
    args: ["mcp-server-fetch"],
    env: { LOG_LEVEL: "debug" },
    autostart: true
  });

  expect(edited).toMatchObject({
    id: server.id,
    name: "renamed",
    autostart: true,
    launch: { command: "uvx", args: ["mcp-server-fetch"], env: { LOG_LEVEL: "debug" }, secretEnv: [] }
  });
});

test("keeps Catalog metadata when a registry server is edited", () => {
  const server = saveServer(db, {
    name: "github",
    source: "registry",
    registryName: "io.github.github/github-mcp-server",
    version: "1.0.0",
    autostart: true,
    launch: { type: "stdio", command: "docker", args: ["run"], env: {} },
    secrets: {}
  });

  expect(edit(server, { args: ["run", "-i"] })).toMatchObject({
    source: "registry",
    registryName: "io.github.github/github-mcp-server",
    version: "1.0.0"
  });
});

test("saves a new Catalog version when one is given", () => {
  const server = saveServer(db, {
    name: "github",
    source: "registry",
    registryName: "io.github.github/github-mcp-server",
    version: "1.0.0",
    autostart: true,
    launch: { type: "stdio", command: "docker", args: ["run"], env: {} },
    secrets: {}
  });

  expect(edit(server, { version: "1.1.0" })).toMatchObject({
    registryName: "io.github.github/github-mcp-server",
    version: "1.1.0"
  });
});

test("replaces a typed secret and keeps a blank one", () => {
  const server = custom("everything", { API_KEY: "old", TOKEN: "tok" });
  edit(server, { secrets: { API_KEY: "new" }, keepSecrets: { TOKEN: "TOKEN" } });

  expect(launchFor(db, server.id).env).toEqual({ API_KEY: "new", TOKEN: "tok" });
});

test("moves a renamed secret's value and deletes the old key", () => {
  const server = custom("everything", { API_KEY: "sk" });

  expect(edit(server, { keepSecrets: { TOKEN: "API_KEY" } }).launch.secretEnv).toEqual(["TOKEN"]);
  expect([...keyring]).toEqual([[key(server, "TOKEN"), "sk"]]);
});

test("swaps two secret names without losing either value", () => {
  const server = custom("everything", { A: "a", B: "b" });
  edit(server, { keepSecrets: { A: "B", B: "A" } });

  expect(launchFor(db, server.id).env).toEqual({ A: "b", B: "a" });
});

test("deletes removed secrets and ones switched to plain", () => {
  const server = custom("everything", { API_KEY: "sk", TOKEN: "tok" });
  edit(server, { env: { TOKEN: "visible" } });

  expect(keyring.size).toBe(0);
  expect(launchFor(db, server.id).env).toEqual({ TOKEN: "visible" });
});

test("rejects a name another server uses", () => {
  custom("everything");
  const other = custom("other");

  expect(() => edit(other, { name: "everything" })).toThrow('A server named "everything" already exists.');
});

test("rejects keeping a secret the server doesn't have", () => {
  const server = custom();

  expect(() => edit(server, { keepSecrets: { TOKEN: "API_KEY" } })).toThrow("There's no stored secret named API_KEY.");
});

test("asks for a renamed secret again when its value is missing from the keyring", () => {
  const server = custom("everything", { API_KEY: "sk" });
  keyring.clear();

  expect(() => edit(server, { keepSecrets: { TOKEN: "API_KEY" } })).toThrow(
    "The secret API_KEY is missing from your keychain. Enter its value again."
  );
});

test("puts earlier secret values back and leaves the row unchanged when a later write fails", () => {
  const server = custom("everything", { API_KEY: "old" });

  expect(() => edit(server, { name: "renamed", secrets: { API_KEY: "new", TOKEN: "fail" } })).toThrow(
    "Keyring is locked"
  );
  expect([...keyring]).toEqual([[key(server, "API_KEY"), "old"]]);
  expect(listServers(db)).toEqual([server]);
});

test("refuses to edit a server that no longer exists", () => {
  const server = custom();
  deleteServer(db, server.id);

  expect(() => edit(server)).toThrow("That server no longer exists.");
});

const remote = (secrets: Record<string, string> = { Authorization: "Bearer sk" }) =>
  addCustomServer(db, {
    type: "http",
    name: "acme",
    url: "https://mcp.example.com/mcp",
    headers: { "X-Region": "eu" },
    secrets,
    autostart: false
  });

test("stores secret headers in the keyring and plain ones in the database", () => {
  const server = remote();

  expect(server.launch).toEqual({
    type: "http",
    url: "https://mcp.example.com/mcp",
    headers: { "X-Region": "eu" },
    secretHeaders: ["Authorization"]
  });
  expect(keyring.get(`server:${server.id}:Authorization`)).toBe("Bearer sk");
  expect(JSON.stringify(db.$client.prepare("select * from installed_servers").all())).not.toContain("Bearer sk");
});

test("connects a remote server with its secret headers merged in", () => {
  const server = remote();

  expect(launchFor(db, server.id)).toEqual({
    type: "http",
    url: "https://mcp.example.com/mcp",
    headers: { "X-Region": "eu", Authorization: "Bearer sk" }
  });
});

test("renames a stored header and deletes the remote server's secrets with it", () => {
  const server = remote();
  const edited = editServer(db, {
    type: "http",
    id: server.id,
    name: "acme",
    url: "https://mcp.example.com/mcp",
    headers: {},
    secrets: {},
    keepSecrets: { "X-Api-Key": "Authorization" },
    autostart: false
  });

  expect(edited.launch).toMatchObject({ headers: {}, secretHeaders: ["X-Api-Key"] });
  expect([...keyring]).toEqual([[`server:${server.id}:X-Api-Key`, "Bearer sk"]]);

  deleteServer(db, server.id);
  expect(keyring.size).toBe(0);
});

test("rejects a built URL that doesn't parse before touching the keyring", () => {
  const save = () =>
    saveServer(db, {
      name: "tenant",
      source: "registry",
      registryName: "io.github.acme/tenant",
      version: "1.0.0",
      autostart: true,
      launch: { type: "http", url: "https://my tenant.acme.dev/mcp", headers: {} },
      secrets: { Authorization: "Bearer sk" }
    });

  expect(save).toThrow("Enter a valid URL, like https://example.com/mcp");
  expect(keyring.size).toBe(0);
  expect(listServers(db)).toEqual([]);
});

test("refuses to turn a local server into a remote one", () => {
  const server = custom();

  expect(() =>
    editServer(db, {
      type: "http",
      id: server.id,
      name: server.name,
      url: "https://mcp.example.com/mcp",
      headers: {},
      secrets: {},
      keepSecrets: {},
      autostart: false
    })
  ).toThrow("A server's type can't change.");
});
