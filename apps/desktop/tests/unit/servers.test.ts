import { beforeEach, expect, test, vi } from "vitest";
import { fileURLToPath } from "node:url";

import { createDatabase, listServers, type Database } from "@openmcp/database";

const keyring = vi.hoisted(() => new Map<string, string>());

vi.mock("@openmcp/secrets", () => ({
  setSecret: (key: string, value: string) => {
    if (value === "fail") throw new Error("Keyring is locked");
    keyring.set(key, value);
  },
  deleteSecret: (key: string) => keyring.delete(key)
}));

const { addCustomServer, deleteServer } = await import("../../src/main/servers");

const migrationsFolder = fileURLToPath(new URL("../../../../packages/database/migrations", import.meta.url));

let db: Database;
beforeEach(() => {
  keyring.clear();
  db = createDatabase({ path: ":memory:", migrationsFolder });
});

test("stores secret values in the keyring and only their names in the database", () => {
  const server = addCustomServer(db, {
    name: "everything",
    command: "npx",
    args: ["-y", "server-everything"],
    env: { LOG_LEVEL: "debug" },
    secrets: { API_KEY: "sk-secret-value" },
    autostart: false
  });

  expect(server.launch).toEqual({ command: "npx", args: ["-y", "server-everything"], env: { LOG_LEVEL: "debug" }, secretEnv: ["API_KEY"] });
  expect(keyring.get(`server:${server.id}:API_KEY`)).toBe("sk-secret-value");

  const rows = JSON.stringify(db.$client.prepare("select * from installed_servers").all());
  expect(rows).not.toContain("sk-secret-value");
});

test("rejects a duplicate name with a readable error", () => {
  const input = { name: "everything", command: "npx", args: [], env: {}, secrets: {}, autostart: false };
  addCustomServer(db, input);

  expect(() => addCustomServer(db, input)).toThrow('A server named "everything" already exists.');
});

test("removes already-stored secrets when a later one fails to save", () => {
  const input = { name: "everything", command: "npx", args: [], env: {}, secrets: { FIRST: "ok", SECOND: "fail" }, autostart: false };

  expect(() => addCustomServer(db, input)).toThrow("Keyring is locked");
  expect(keyring.size).toBe(0);
  expect(listServers(db)).toEqual([]);
});

test("deletes a server's secrets when the server is removed", () => {
  const server = addCustomServer(db, { name: "everything", command: "npx", args: [], env: {}, secrets: { API_KEY: "sk" }, autostart: false });

  deleteServer(db, server.id);

  expect(listServers(db)).toEqual([]);
  expect(keyring.size).toBe(0);
});
