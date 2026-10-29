import { beforeEach, expect, test } from "vitest";

import {
  addServer,
  createDatabase,
  migrationsFolder,
  getServer,
  listServers,
  removeServer,
  type Database
} from "../../src";

const launch = { command: "npx", args: ["-y", "server-everything"], env: {}, secretEnv: ["API_KEY"] };

let db: Database;
beforeEach(() => {
  db = createDatabase({ path: ":memory:", migrationsFolder });
});

test("adds and lists custom servers with their launch spec", () => {
  const server = addServer(db, { name: "test-server", source: "custom", launch });

  expect(server.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(server.autostart).toBe(false);
  expect(listServers(db)).toEqual([server]);
});

test("rejects duplicate names because the name is the gateway URL", () => {
  addServer(db, { name: "test-server", source: "custom", launch });
  expect(() => addServer(db, { name: "test-server", source: "custom", launch })).toThrow();
});

test("requires registry name and version for registry servers", () => {
  expect(() => addServer(db, { name: "github", source: "registry", launch })).toThrow();
  expect(
    addServer(db, { name: "github", source: "registry", registryName: "io.github/github", version: "1.2.0", launch })
      .version
  ).toBe("1.2.0");
});

test("removes servers and reports whether one was removed", () => {
  const server = addServer(db, { name: "test-server", source: "custom", launch });

  expect(removeServer(db, server.id)).toBe(true);
  expect(removeServer(db, server.id)).toBe(false);
  expect(listServers(db)).toEqual([]);
});

test("gets a server by id, or undefined when it doesn't exist", () => {
  const server = addServer(db, { name: "test-server", source: "custom", launch });

  expect(getServer(db, server.id)).toEqual(server);
  expect(getServer(db, crypto.randomUUID())).toBeUndefined();
});
