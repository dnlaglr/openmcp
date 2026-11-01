import { expect, test } from "vitest";

import type { ServerState } from "@openmcp/contracts";

import { ledStatus, primaryAction, statusLabel } from "../../src/renderer/features/servers/serverStatus";

const state = (status: ServerState["status"]): ServerState => ({
  id: crypto.randomUUID(),
  status,
  error: null,
  restarts: 0,
  pid: null,
  startedAt: null
});

test("names each state the way the list shows it", () => {
  expect(statusLabel(state("starting"), false, false)).toBe("Starting");
  expect(statusLabel(state("starting"), true, false)).toBe("Connecting");
  expect(statusLabel(state("signin"), true, false)).toBe("Needs sign-in");
  expect(statusLabel(state("signin"), true, true)).toBe("Waiting for browser");
});

test("spins the LED while the browser sign-in is open", () => {
  expect(ledStatus(state("signin"), true)).toBe("starting");
  expect(ledStatus(state("error"), false)).toBe("error");
});

test("offers the one action that fits the state", () => {
  expect(primaryAction(state("stopped"), false)).toEqual({ kind: "start", label: "Start" });
  expect(primaryAction(state("error"), false)).toEqual({ kind: "retry", label: "Retry" });
  expect(primaryAction(state("signin"), false)).toEqual({ kind: "signIn", label: "Sign in" });
  expect(primaryAction(state("signin"), true)).toEqual({ kind: "startOver", label: "Start over" });
  expect(primaryAction(state("running"), false)).toEqual({ kind: "stop", label: "Stop" });
});
