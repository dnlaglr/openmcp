import { beforeEach, describe, expect, test, vi } from "vitest";

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

describe("servers:callTool", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const callId = "22222222-2222-4222-8222-222222222222";
  const input = { id, name: "echo", arguments: { message: "hi" }, callId };

  function register(client?: object) {
    const supervisor = { client: vi.fn(() => client) };
    registerServerHandlers(db, supervisor as never, {} as never, { counts: () => [] });
    return supervisor;
  }

  test("runs the tool on the server's live client and times it", async () => {
    const result = { content: [{ type: "text", text: "hi" }] };
    const callTool = vi.fn(async () => result);
    register({ callTool });

    const run = await handlers.get("servers:callTool")!(input);

    expect(run).toEqual({ result, durationMs: expect.any(Number) });
    expect(callTool).toHaveBeenCalledWith(
      { name: "echo", arguments: { message: "hi" } },
      { signal: expect.any(AbortSignal) }
    );
  });

  test("asks to start a server that isn't running", async () => {
    register();

    await expect(handlers.get("servers:callTool")!(input)).rejects.toThrow("Start the server to run its tools.");
  });

  test("explains when the server stops before the tool finishes", async () => {
    const supervisor = register({
      callTool: async () => {
        supervisor.client.mockReturnValue(undefined);
        throw new Error("Connection closed");
      }
    });

    await expect(handlers.get("servers:callTool")!(input)).rejects.toThrow(
      "The server stopped before the tool finished."
    );
  });

  test("cancels a call in flight", async () => {
    register({
      callTool: (_params: unknown, { signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("AbortError"))))
    });

    const run = handlers.get("servers:callTool")!(input);
    await handlers.get("servers:cancelToolCall")!({ callId });

    await expect(run).rejects.toThrow("Cancelled.");
  });
});
