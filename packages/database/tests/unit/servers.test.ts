import { beforeEach, expect, test, vi } from "vitest";

import {
  addServer,
  createDatabase,
  migrationsFolder,
  getServer,
  listServers,
  removeServer,
  updateServer,
  type Database
} from "../../src";

const launch = {
  type: "stdio" as const,
  command: "npx",
  args: ["-y", "server-everything"],
  env: {},
  secretEnv: ["API_KEY"]
};

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

test("updates a server and bumps updatedAt, or returns undefined for an unknown id", () => {
  vi.useFakeTimers({ now: new Date("2026-10-01T00:00:00Z") });
  const server = addServer(db, { name: "test-server", source: "custom", launch });

  vi.setSystemTime(new Date("2026-10-02T00:00:00Z"));
  const updated = updateServer(db, server.id, { name: "renamed", autostart: true });
  vi.useRealTimers();

  expect(updated).toEqual({
    ...server,
    name: "renamed",
    autostart: true,
    updatedAt: new Date("2026-10-02T00:00:00Z")
  });
  expect(getServer(db, server.id)).toEqual(updated);
  expect(updateServer(db, crypto.randomUUID(), { name: "ghost" })).toBeUndefined();
});
