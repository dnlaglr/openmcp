import { commandLine, MAX_LOG_LINES, type LogLine, type ServerState } from "@openmcp/contracts";

import type { Connect, Connection, Launch } from "./connection";

type SupervisorOptions = {
  connect: Connect;
  resolve: (id: string) => Launch;
  onState: (state: ServerState) => void;
  onLog: (line: LogLine) => void;
  restartDelays?: number[];
  stableAfterMs?: number;
};

type Entry = {
  state: ServerState;
  logs: LogLine[];
  connection?: Connection;
  retry?: ReturnType<typeof setTimeout>;
  run: number;
};

const RESTART_DELAYS = [1_000, 2_000, 4_000, 8_000, 16_000];
const STABLE_AFTER_MS = 30_000;

export function createSupervisor({
  connect,
  resolve,
  onState,
  onLog,
  restartDelays = RESTART_DELAYS,
  stableAfterMs = STABLE_AFTER_MS
}: SupervisorOptions) {
  const entries = new Map<string, Entry>();

  function entryFor(id: string) {
    let entry = entries.get(id);
    if (!entry) {
      const state: ServerState = { id, status: "stopped", error: null, restarts: 0, pid: null, startedAt: null };

      entry = { state, logs: [], run: 0 };
      entries.set(id, entry);
    }

    return entry;
  }

  function setState(entry: Entry, patch: Partial<ServerState>) {
    entry.state = { ...entry.state, ...patch };
    onState(entry.state);
  }

  function log(entry: Entry, source: LogLine["source"], text: string) {
    const line: LogLine = { serverId: entry.state.id, at: new Date(), source, text };

    entry.logs.push(line);
    if (entry.logs.length > MAX_LOG_LINES) entry.logs.shift();
    onLog(line);
  }

  function fail(entry: Entry, reason: string, retry: boolean) {
    const restarts = entry.state.restarts;
    const delay = retry ? restartDelays[restarts] : undefined;

    if (delay === undefined) {
      const gaveUp = `${reason}. Gave up after ${restarts} ${restarts === 1 ? "restart" : "restarts"}.`;
      log(entry, "openmcp", retry ? gaveUp : reason);
      setState(entry, { status: "error", error: reason, pid: null, startedAt: null });
      return;
    }

    log(entry, "openmcp", `${reason}. Restarting in ${delay / 1000}s.`);
    setState(entry, { status: "starting", error: reason, restarts: restarts + 1, pid: null, startedAt: null });
    entry.retry = setTimeout(() => void launch(entry), delay);
  }

  function exited(entry: Entry) {
    const ranFor = Date.now() - (entry.state.startedAt?.getTime() ?? 0);
    entry.connection = undefined;

    if (ranFor >= stableAfterMs) entry.state = { ...entry.state, restarts: 0 };
    fail(entry, "Process exited", true);
  }

  async function launch(entry: Entry) {
    const run = ++entry.run;

    try {
      const spec = resolve(entry.state.id);
      log(entry, "openmcp", `Starting ${commandLine(spec)}`);

      const connection = await connect(spec, {
        onLog: (text) => log(entry, "stderr", text),
        onExit: () => {
          if (entry.run === run) exited(entry);
        }
      });
      if (entry.run !== run) return void (await connection.close());

      entry.connection = connection;
      setState(entry, { status: "running", error: null, pid: connection.pid, startedAt: new Date() });
    } catch (error) {
      if (entry.run !== run) return;

      fail(entry, error instanceof Error ? error.message : String(error), entry.state.restarts > 0);
    }
  }

  async function start(id: string) {
    const entry = entryFor(id);
    if (entry.state.status === "starting" || entry.state.status === "running") return;

    setState(entry, { status: "starting", error: null, restarts: 0 });
    await launch(entry);
  }

  async function stop(id: string) {
    const entry = entries.get(id);
    if (!entry || entry.state.status === "stopped") return;

    entry.run++;
    clearTimeout(entry.retry);

    const connection = entry.connection;
    entry.connection = undefined;
    await connection?.close();

    log(entry, "openmcp", "Stopped");
    setState(entry, { status: "stopped", error: null, restarts: 0, pid: null, startedAt: null });
  }

  async function restart(id: string) {
    await stop(id);
    await start(id);
  }

  async function restartIfActive(id: string) {
    const status = entries.get(id)?.state.status;
    if (status === "starting" || status === "running") await restart(id);
  }

  async function remove(id: string) {
    await stop(id);
    entries.delete(id);
  }

  return {
    start,
    stop,
    restart,
    restartIfActive,
    remove,
    stopAll: () => Promise.all([...entries.keys()].map(stop)),
    states: () => [...entries.values()].map((entry) => entry.state),
    logs: (id: string) => entries.get(id)?.logs ?? [],
    note: (id: string, text: string) => {
      const entry = entries.get(id);
      if (entry) log(entry, "openmcp", text);
    },
    client: (id: string) => entries.get(id)?.connection?.client
  };
}

export type Supervisor = ReturnType<typeof createSupervisor>;
