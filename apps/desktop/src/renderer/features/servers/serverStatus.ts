import type { ServerState, ServerStatus } from "@openmcp/contracts";

const labels: Record<ServerStatus, string> = {
  stopped: "Stopped",
  starting: "Starting",
  running: "Running",
  error: "Error",
  signin: "Needs sign-in"
};

export type Primary = { kind: "start" | "stop" | "retry" | "signIn" | "startOver"; label: string };

export const isActive = (state: ServerState) => state.status === "starting" || state.status === "running";

export function statusLabel(state: ServerState, remote: boolean, waiting: boolean) {
  if (waiting) return "Waiting for browser";
  if (state.status === "starting") return remote ? "Connecting" : "Starting";
  return labels[state.status];
}

export const ledStatus = (state: ServerState, waiting: boolean): ServerStatus => (waiting ? "starting" : state.status);

export function primaryAction(state: ServerState, waiting: boolean): Primary {
  if (waiting) return { kind: "startOver", label: "Start over" };
  if (state.status === "stopped") return { kind: "start", label: "Start" };
  if (state.status === "error") return { kind: "retry", label: "Retry" };
  if (state.status === "signin") return { kind: "signIn", label: "Sign in" };
  return { kind: "stop", label: "Stop" };
}
