import { afterEach, expect, test, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import type { LogLine, ServerState } from "@openmcp/contracts";

import { describeServer, stdioConnector, type Launch } from "../../src/main/servers/connection";
import { createSupervisor, type Supervisor } from "../../src/main/servers/supervisor";

const fixture = fileURLToPath(new URL("./fixtures/stdioServer.mts", import.meta.url));
const fixtureLaunch = (env: Record<string, string> = {}): Launch => ({
  command: process.execPath,
  args: [fixture],
  env
});

let supervisor: Supervisor | undefined;

afterEach(async () => {
  await supervisor?.stopAll();
});

function setup(launch: Launch, restartDelays: number[] = []) {
  const states: ServerState[] = [];
  const logs: LogLine[] = [];

  supervisor = createSupervisor({
    connect: stdioConnector("test"),
    resolve: () => launch,
    onState: (state) => states.push(state),
    onLog: (line) => logs.push(line),
    restartDelays
  });

  return { supervisor, id: randomUUID(), logs, last: () => states.at(-1) };
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
  const { supervisor, id, last } = setup({ command: "openmcp-command-that-does-not-exist", args: [], env: {} });

  await supervisor.start(id);

  expect(last()?.status).toBe("error");
  expect(last()?.error).toContain("ENOENT");
});

test("reports a server that exits during startup by its last stderr line", async () => {
  const crash = "console.error('Missing API_KEY'); process.exit(2)";
  const { supervisor, id, last } = setup({ command: process.execPath, args: ["-e", crash], env: {} });

  await supervisor.start(id);

  expect(last()).toMatchObject({ status: "error", error: "Missing API_KEY" });
});
