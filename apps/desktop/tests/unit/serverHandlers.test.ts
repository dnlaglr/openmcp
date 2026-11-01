import { beforeEach, expect, test, vi } from "vitest";

import { addServer, createDatabase, getServer, migrationsFolder, type Database } from "@openmcp/database";

const handlers = vi.hoisted(() => new Map<string, (input: unknown) => unknown>());
const emit = vi.hoisted(() => vi.fn());

vi.mock("../../src/main/ipc", () => ({
  emit,
  handle: (channel: string, handler: (input: unknown) => unknown) => void handlers.set(channel, handler)
}));
vi.mock("@openmcp/secrets", () => ({ setSecret: () => {}, getSecret: () => null, deleteSecret: () => {} }));
vi.mock("../../src/main/servers/oauth", () => ({ hasTokens: () => false }));

const { registerServerHandlers } = await import("../../src/main/servers/handlers");

let db: Database;
beforeEach(() => {
  handlers.clear();
  emit.mockClear();
  db = createDatabase({ path: ":memory:", migrationsFolder });
});

test("turns autostart on without restarting the server", async () => {
  const server = addServer(db, {
    name: "fs",
    source: "custom",
    launch: { type: "stdio", command: "npx", args: [], env: {}, secretEnv: [] },
    autostart: false
  });
  const supervisor = { restart: vi.fn(), restartIfActive: vi.fn() };
  registerServerHandlers(db, supervisor as never, {} as never, { counts: () => [] });

  await handlers.get("servers:setAutostart")!({ id: server.id, autostart: true });

  expect(getServer(db, server.id)?.autostart).toBe(true);
  expect(supervisor.restart).not.toHaveBeenCalled();
  expect(supervisor.restartIfActive).not.toHaveBeenCalled();
  expect(emit).toHaveBeenCalledWith("servers:changed");
});
