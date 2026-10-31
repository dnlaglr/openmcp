import { afterEach, expect, test, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import type { LogLine, ServerState } from "@openmcp/contracts";

import { connector, describeServer, type Launch } from "../../src/main/servers/connection";
import { createSupervisor, type Supervisor } from "../../src/main/servers/supervisor";
import { serveHttpFixture, type HttpFixture } from "./fixtures/httpServer";

const fixture = fileURLToPath(new URL("./fixtures/stdioServer.mts", import.meta.url));
const fixtureLaunch = (env: Record<string, string> = {}): Launch => ({
  type: "stdio",
  command: process.execPath,
  args: [fixture],
  env
});

let supervisor: Supervisor | undefined;
let remote: HttpFixture | undefined;

afterEach(async () => {
  await supervisor?.stopAll();
  await remote?.stop();
  remote = undefined;
});

function setup(launch: Launch, restartDelays: number[] = [], retryEveryMs = 50) {
  const states: ServerState[] = [];
  const logs: LogLine[] = [];

  supervisor = createSupervisor({
    connect: connector("test", { pingEveryMs: 100 }),
    resolve: () => launch,
    onState: (state) => states.push(state),
    onLog: (line) => logs.push(line),
    restartDelays,
    retryEveryMs
  });

  return {
    supervisor,
    id: randomUUID(),
    logs,
    statuses: () => states.map((state) => state.status),
    last: () => states.at(-1)
  };
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test("starts a real server over stdio and captures its stderr", async () => {
  const { supervisor, id, logs, last } = setup(fixtureLaunch());

  await supervisor.start(id);

  expect(last()).toMatchObject({ status: "running", error: null, pid: expect.any(Number) });
  await vi.waitFor(() =>
    expect(logs.some((line) => line.source === "stderr" && line.text.startsWith("fixture ready"))).toBe(true)
  );
});

test("describes its tools across every page, its resources, and no prompts", async () => {
  const { supervisor, id } = setup(fixtureLaunch({ FIXTURE_TOOL: "from_env" }));
  await supervisor.start(id);

  const details = await describeServer(supervisor.client(id)!);

  expect(details).toMatchObject({
    info: { name: "fixture", version: "1.0.0" },
    protocolVersion: expect.any(String),
    instructions: "Use echo to test the connection.",
    prompts: null
  });
  expect(details.tools?.map((tool) => tool.name)).toEqual(["echo", "from_env"]);
  expect(details.resources?.map((resource) => resource.uri)).toEqual(["fixture://readme"]);
});

test("stop ends the child process", async () => {
  const { supervisor, id, last } = setup(fixtureLaunch());
  await supervisor.start(id);
  const pid = last()!.pid!;

  await supervisor.stop(id);

  expect(last()?.status).toBe("stopped");
  await vi.waitFor(() => expect(isAlive(pid)).toBe(false));
});

test("restarts a crashing server, then reports an error", async () => {
  const { supervisor, id, last } = setup(fixtureLaunch({ FIXTURE_EXIT_AFTER_MS: "50" }), [50]);

  await supervisor.start(id);

  await vi.waitFor(() => expect(last()?.status).toBe("error"), { timeout: 5_000 });
  expect(last()).toMatchObject({ error: "Process exited", restarts: 1 });
});

test("reports a command that doesn't exist by its spawn error", async () => {
  const { supervisor, id, last } = setup({
    type: "stdio",
    command: "openmcp-command-that-does-not-exist",
    args: [],
    env: {}
  });

  await supervisor.start(id);

  expect(last()?.status).toBe("error");
  expect(last()?.error).toContain("ENOENT");
});

test("reports a server that exits during startup by its last stderr line", async () => {
  const crash = "console.error('Missing API_KEY'); process.exit(2)";
  const { supervisor, id, last } = setup({ type: "stdio", command: process.execPath, args: ["-e", crash], env: {} });

  await supervisor.start(id);

  expect(last()).toMatchObject({ status: "error", error: "Missing API_KEY" });
});

const httpToken = "e2e-http-token";

const remoteLaunch = (url: string, headers: Record<string, string> = { Authorization: `Bearer ${httpToken}` }) =>
  ({ type: "http", url, headers }) satisfies Launch;

test("connects to a remote server with its headers and describes its tools", async () => {
  remote = await serveHttpFixture(httpToken);
  const { supervisor, id, last } = setup(remoteLaunch(remote.url));

  await supervisor.start(id);

  expect(last()).toMatchObject({ status: "running", error: null, pid: null });
  const client = supervisor.client(id);
  if (!client) throw new Error("Expected a client");
  expect((await describeServer(client)).tools?.map((tool) => tool.name)).toEqual(["remote_echo"]);
});

test.each([
  [
    "a wrong key",
    { Authorization: "Bearer wrong" },
    "/mcp",
    "The server rejected the credentials (HTTP 401). Check the headers."
  ],
  ["a wrong path", undefined, "/nope", "Nothing answered at this URL (HTTP 404). Check the address."]
])("stops at once on %s", async (_case, headers, path, error) => {
  remote = await serveHttpFixture(httpToken);
  const { supervisor, id, statuses, last } = setup(remoteLaunch(remote.url.replace("/mcp", path), headers), [0]);

  await supervisor.start(id);

  expect(statuses()).toEqual(["starting", "error"]);
  expect(last()?.error).toBe(error);
});

test("waits for a sign-in when a remote server wants one and has no key", async () => {
  remote = await serveHttpFixture(httpToken);
  const { supervisor, id, statuses, last } = setup(remoteLaunch(remote.url, {}), [0]);

  await supervisor.start(id);

  expect(statuses()).toEqual(["starting", "signin"]);
  expect(last()?.error).toBeNull();
});

test("keeps retrying a remote server that answers 503, then connects", async () => {
  remote = await serveHttpFixture(httpToken);
  remote.failWith(503);
  const { supervisor, id, logs, last } = setup(remoteLaunch(remote.url), [0]);

  await supervisor.start(id);
  await vi.waitFor(
    () => expect(logs.filter((line) => line.text.includes("Reconnecting in")).length).toBeGreaterThan(2),
    {
      timeout: 5_000
    }
  );
  expect(last()?.status).toBe("starting");

  remote.failWith(null);
  await vi.waitFor(() => expect(last()?.status).toBe("running"), { timeout: 5_000 });
});

test("notices a remote server going away and reconnects when it comes back", async () => {
  remote = await serveHttpFixture(httpToken);
  const { supervisor, id, logs, last } = setup(remoteLaunch(remote.url), [0]);
  await supervisor.start(id);

  await remote.stop();
  await vi.waitFor(() => expect(logs.some((line) => line.text.startsWith("Lost connection"))).toBe(true), {
    timeout: 5_000
  });
  expect(last()?.status).toBe("starting");

  await remote.start();
  await vi.waitFor(() => expect(last()?.status).toBe("running"), { timeout: 5_000 });
});

test("stays stopped when stopped while a ping is due", async () => {
  remote = await serveHttpFixture(httpToken);
  const { supervisor, id, logs, last } = setup(remoteLaunch(remote.url));
  await supervisor.start(id);

  await supervisor.stop(id);
  await remote.stop();
  await new Promise((resolve) => setTimeout(resolve, 300));

  expect(last()?.status).toBe("stopped");
  expect(logs.some((line) => line.text.startsWith("Lost connection"))).toBe(false);
});
