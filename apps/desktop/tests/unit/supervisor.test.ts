import type { Client } from "@modelcontextprotocol/client";
import { describe, expect, test, vi } from "vitest";

import { MAX_LOG_LINES, type LogLine, type ServerState } from "@openmcp/contracts";

import type { Connect, Launch } from "../../src/main/servers/connection";
import { createSupervisor } from "../../src/main/servers/supervisor";

const id = "4f8b6a3e-9c1d-4e2f-8a7b-1c2d3e4f5a6b";
const launch: Launch = { command: "npx", args: ["-y", "server"], env: {} };

type FakeProcess = { exit: () => void; closed: boolean };

type Options = {
  connect?: Connect;
  resolve?: () => Launch;
  failures?: Record<number, string>;
  stderr?: string[];
  restartDelays?: number[];
  stableAfterMs?: number;
};

function setup(options: Options = {}) {
  const states: ServerState[] = [];
  const logs: LogLine[] = [];
  const processes: FakeProcess[] = [];
  let attempts = 0;

  const connect: Connect = async (_launch, { onLog, onExit }) => {
    const failure = options.failures?.[attempts++];
    if (failure) throw new Error(failure);

    for (const line of options.stderr ?? ["server booted"]) onLog(line);

    const fake: FakeProcess = { exit: onExit, closed: false };
    processes.push(fake);
    return { client: {} as Client, pid: 1000 + processes.length, close: async () => void (fake.closed = true) };
  };

  const supervisor = createSupervisor({
    connect: options.connect ?? connect,
    resolve: options.resolve ?? (() => launch),
    onState: (state) => states.push(state),
    onLog: (line) => logs.push(line),
    restartDelays: options.restartDelays ?? [0, 0],
    stableAfterMs: options.stableAfterMs ?? 60_000
  });

  return {
    supervisor,
    logs,
    processes,
    attempts: () => attempts,
    statuses: () => states.map((state) => state.status),
    last: () => states.at(-1)
  };
}

describe("start", () => {
  test("goes from starting to running with the process's pid and stderr", async () => {
    const { supervisor, logs, statuses, last } = setup();

    await supervisor.start(id);

    expect(statuses()).toEqual(["starting", "running"]);
    expect(last()).toMatchObject({ error: null, pid: 1001, startedAt: expect.any(Date) });
    expect(logs.map((line) => [line.source, line.text])).toEqual([
      ["openmcp", "Starting npx -y server"],
      ["stderr", "server booted"]
    ]);
  });

  test("reports a failed first start at once instead of retrying", async () => {
    const { supervisor, attempts, statuses, last } = setup({ failures: { 0: "spawn npx ENOENT" } });

    await supervisor.start(id);

    expect(attempts()).toBe(1);
    expect(statuses()).toEqual(["starting", "error"]);
    expect(last()).toMatchObject({ error: "spawn npx ENOENT", restarts: 0 });
  });

  test("reports a launch that can't be resolved without spawning anything", async () => {
    const { supervisor, attempts, last } = setup({
      resolve: () => {
        throw new Error("The secret API_KEY is missing from your keychain.");
      }
    });

    await supervisor.start(id);

    expect(attempts()).toBe(0);
    expect(last()).toMatchObject({ status: "error", error: "The secret API_KEY is missing from your keychain." });
  });

  test("restarts with the server's current launch config", async () => {
    let version = 0;
    const { supervisor, logs } = setup({ resolve: () => ({ ...launch, args: [`v${++version}`] }) });

    await supervisor.start(id);
    await supervisor.restart(id);

    expect(logs.filter((line) => line.text.startsWith("Starting")).map((line) => line.text)).toEqual([
      "Starting npx v1",
      "Starting npx v2"
    ]);
  });
});

describe("crashes", () => {
  test("restarts after each configured delay, then gives up with an error", async () => {
    const { supervisor, processes, last } = setup({ restartDelays: [0, 0] });
    await supervisor.start(id);

    processes[0].exit();
    await vi.waitFor(() => expect(processes).toHaveLength(2));
    processes[1].exit();
    await vi.waitFor(() => expect(processes).toHaveLength(3));
    processes[2].exit();

    expect(last()).toMatchObject({ status: "error", error: "Process exited", restarts: 2, pid: null });
  });

  test("keeps backing off when a relaunch fails", async () => {
    const { supervisor, processes, logs, last } = setup({ failures: { 1: "spawn npx ENOENT" }, restartDelays: [0, 0] });
    await supervisor.start(id);

    processes[0].exit();

    await vi.waitFor(() => expect(last()?.status).toBe("running"));
    expect(processes).toHaveLength(2);
    expect(last()?.restarts).toBe(2);
    expect(logs.map((line) => line.text)).toContain("spawn npx ENOENT. Restarting in 0s.");
  });

  test("forgives earlier crashes once a run has been stable", async () => {
    const { supervisor, processes, last } = setup({ restartDelays: [0], stableAfterMs: 0 });
    await supervisor.start(id);

    processes[0].exit();
    await vi.waitFor(() => expect(processes).toHaveLength(2));
    processes[1].exit();
    await vi.waitFor(() => expect(processes).toHaveLength(3));

    expect(last()).toMatchObject({ status: "running", restarts: 1 });
  });
});

describe("stop", () => {
  test("closes the process without treating it as a crash", async () => {
    const { supervisor, processes, last } = setup();
    await supervisor.start(id);

    await supervisor.stop(id);
    processes[0].exit();

    expect(processes[0].closed).toBe(true);
    expect(processes).toHaveLength(1);
    expect(last()).toMatchObject({ status: "stopped", pid: null, startedAt: null });
  });

  test("closes a connection that finishes after stop was requested", async () => {
    const late = { closed: false, finish: () => {} };
    const { supervisor, statuses } = setup({
      connect: () =>
        new Promise((resolve) => {
          late.finish = () => resolve({ client: {} as Client, pid: 1, close: async () => void (late.closed = true) });
        })
    });

    const starting = supervisor.start(id);
    await supervisor.stop(id);
    late.finish();
    await starting;

    expect(late.closed).toBe(true);
    expect(statuses()).toEqual(["starting", "stopped"]);
  });

  test("ignores a stopped process exiting after the server started again", async () => {
    const { supervisor, processes, last } = setup();
    await supervisor.start(id);
    await supervisor.stop(id);
    await supervisor.start(id);

    processes[0].exit();

    expect(processes).toHaveLength(2);
    expect(last()?.status).toBe("running");
  });

  test("remove forgets the server's state and logs", async () => {
    const { supervisor, processes } = setup();
    await supervisor.start(id);

    await supervisor.remove(id);

    expect(processes[0].closed).toBe(true);
    expect(supervisor.states()).toEqual([]);
    expect(supervisor.logs(id)).toEqual([]);
  });
});

test("keeps only the most recent log lines", async () => {
  const stderr = Array.from({ length: MAX_LOG_LINES + 10 }, (_, index) => `line ${index}`);
  const { supervisor } = setup({ stderr });

  await supervisor.start(id);

  const lines = supervisor.logs(id);
  expect(lines).toHaveLength(MAX_LOG_LINES);
  expect(lines.at(-1)?.text).toBe(`line ${MAX_LOG_LINES + 9}`);
});

test("notes a line from OpenMCP in a known server's logs and ignores unknown servers", async () => {
  const { supervisor, logs } = setup();
  await supervisor.start(id);

  supervisor.note(id, "Resource shared://doc is also provided by alpha; agents will use alpha's.");
  supervisor.note(crypto.randomUUID(), "nobody hears this");

  expect(logs.at(-1)).toMatchObject({
    serverId: id,
    source: "openmcp",
    text: "Resource shared://doc is also provided by alpha; agents will use alpha's."
  });
  expect(supervisor.logs(id).at(-1)?.text).toBe(logs.at(-1)?.text);
});
