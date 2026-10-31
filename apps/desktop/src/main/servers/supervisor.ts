import { launchLabel, MAX_LOG_LINES, type LogLine, type ServerState } from "@openmcp/contracts";

import { FatalError, SignInRequired, type Connect, type Connection, type Launch } from "./connection";

type SupervisorOptions = {
  connect: Connect;
  resolve: (id: string) => Launch;
  onState: (state: ServerState) => void;
  onLog: (line: LogLine) => void;
  restartDelays?: number[];
  retryEveryMs?: number;
  stableAfterMs?: number;
};

type Entry = {
  state: ServerState;
  logs: LogLine[];
  connection?: Connection;
  retry?: ReturnType<typeof setTimeout>;
  run: number;
  // Remote servers drop with the network and come back on their own, so they never give up.
  keepTrying: boolean;
};

const RESTART_DELAYS = [1_000, 2_000, 4_000, 8_000, 16_000];
const RETRY_EVERY_MS = 60_000;
const STABLE_AFTER_MS = 30_000;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Leaves out the query string, since a pasted URL may carry a key in it.
function startLine(launch: Launch) {
  if (launch.type === "stdio") return `Starting ${launchLabel(launch)}`;

  const { origin, pathname } = new URL(launch.url);
  return `Connecting to ${origin}${pathname}`;
}

export function createSupervisor({
  connect,
  resolve,
  onState,
  onLog,
  restartDelays = RESTART_DELAYS,
  retryEveryMs = RETRY_EVERY_MS,
  stableAfterMs = STABLE_AFTER_MS
}: SupervisorOptions) {
  const entries = new Map<string, Entry>();

  function entryFor(id: string) {
    let entry = entries.get(id);
    if (!entry) {
      const state: ServerState = { id, status: "stopped", error: null, restarts: 0, pid: null, startedAt: null };

      entry = { state, logs: [], run: 0, keepTrying: false };
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
    const delay = retry ? (restartDelays[restarts] ?? (entry.keepTrying ? retryEveryMs : undefined)) : undefined;

    if (delay === undefined) {
      const gaveUp = `${reason}. Gave up after ${restarts} ${restarts === 1 ? "restart" : "restarts"}.`;
      log(entry, "openmcp", retry ? gaveUp : reason);
      setState(entry, { status: "error", error: reason, pid: null, startedAt: null });
      return;
    }

    log(entry, "openmcp", `${reason}. ${entry.keepTrying ? "Reconnecting" : "Restarting"} in ${delay / 1000}s.`);
    setState(entry, { status: "starting", error: reason, restarts: restarts + 1, pid: null, startedAt: null });
    entry.retry = setTimeout(() => void launch(entry), delay);
  }

  function exited(entry: Entry, reason = "Process exited") {
    const ranFor = Date.now() - (entry.state.startedAt?.getTime() ?? 0);
    entry.connection = undefined;

    if (ranFor >= stableAfterMs) entry.state = { ...entry.state, restarts: 0 };
    fail(entry, reason, true);
  }

  async function launch(entry: Entry) {
    const run = ++entry.run;

    // A missing secret or a deleted server won't fix itself, so it never retries.
    let spec: Launch;
    try {
      spec = resolve(entry.state.id);
    } catch (error) {
      fail(entry, message(error), false);
      return;
    }
    entry.keepTrying = spec.type === "http";

    try {
      log(entry, "openmcp", startLine(spec));

      const connection = await connect(spec, {
        onLog: (text) => log(entry, "stderr", text),
        onExit: (reason) => {
          if (entry.run === run) exited(entry, reason);
        }
      });
      if (entry.run !== run) return void (await connection.close());

      entry.connection = connection;
      setState(entry, { status: "running", error: null, pid: connection.pid, startedAt: new Date() });
    } catch (error) {
      if (entry.run !== run) return;

      if (error instanceof SignInRequired) {
        log(entry, "openmcp", "This server needs you to sign in");
        setState(entry, { status: "signin", error: null, restarts: 0, pid: null, startedAt: null });
        return;
      }

      // A command that won't start won't fix itself, but a remote server may only be unreachable for now.
      fail(entry, message(error), !(error instanceof FatalError) && (entry.keepTrying || entry.state.restarts > 0));
    }
  }

  async function start(id: string) {
    const entry = entryFor(id);
    if (entry.state.status === "starting" || entry.state.status === "running") return;

    setState(entry, { status: "starting", error: null, restarts: 0 });
    await launch(entry);
  }

  async function halt(entry: Entry) {
    entry.run++;
    clearTimeout(entry.retry);

    const connection = entry.connection;
    entry.connection = undefined;
    await connection?.close();
  }

  async function stop(id: string) {
    const entry = entries.get(id);
    if (!entry || entry.state.status === "stopped") return;

    await halt(entry);
    log(entry, "openmcp", "Stopped");
    setState(entry, { status: "stopped", error: null, restarts: 0, pid: null, startedAt: null });
  }

  async function requireSignIn(id: string, error: string | null = null) {
    const entry = entryFor(id);
    await halt(entry);
    setState(entry, { status: "signin", error, restarts: 0, pid: null, startedAt: null });
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
    requireSignIn,
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
