import { expect, test } from "vitest";

import type { ClientState } from "@openmcp/contracts";

import {
  agentStatus,
  isActiveNow,
  isWaiting,
  lastActive,
  masked
} from "../../src/renderer/features/agents/agentStatus";

const now = Date.parse("2026-10-31T12:00:00Z");
const ago = (ms: number) => new Date(now - ms);

const agent = (patch: Partial<ClientState> = {}): ClientState => ({
  id: "claude-code",
  name: "Claude Code",
  status: "connected",
  path: "/Users/ada/.claude.json",
  error: null,
  snippet: "{}",
  hint: null,
  lastSeenAt: null,
  backups: 0,
  ...patch
});

test("labels each status the way the list shows it", () => {
  expect(agentStatus(agent({ status: "error" }), false)).toEqual({ label: "Can’t read config", led: "error" });
  expect(agentStatus(agent({ status: "outdated" }), false)).toEqual({ label: "Out of date", led: "signin" });
  expect(agentStatus(agent({ status: "disconnected" }), true)).toEqual({ label: "Connecting", led: "starting" });
});

test("is active within two minutes of a call", () => {
  expect(isActiveNow(agent({ lastSeenAt: ago(90_000) }), now)).toBe(true);
  expect(isActiveNow(agent({ lastSeenAt: ago(150_000) }), now)).toBe(false);
  expect(isActiveNow(agent({ status: "disconnected", lastSeenAt: ago(10_000) }), now)).toBe(false);
});

test("waits for the first call after connecting", () => {
  const connectedAt = now - 60_000;

  expect(isWaiting(agent({ lastSeenAt: ago(5 * 60_000) }), connectedAt)).toBe(true);
  expect(isWaiting(agent({ lastSeenAt: ago(10_000) }), connectedAt)).toBe(false);
  expect(isWaiting(agent({ status: "disconnected" }), connectedAt)).toBe(false);
  expect(isWaiting(agent(), undefined)).toBe(false);
});

test("says when the agent was last active", () => {
  expect(lastActive(agent(), true, now)).toEqual({ text: "Waiting for its first call", tone: "waiting" });
  expect(lastActive(agent({ id: "claude-desktop" }), true, now).text).toBe("Restart it to finish");
  expect(lastActive(agent({ lastSeenAt: ago(30_000) }), false, now)).toEqual({ text: "Active now", tone: "live" });
  expect(lastActive(agent({ lastSeenAt: ago(4 * 60_000) }), false, now).text).toBe("Last call 4 min ago");
  expect(lastActive(agent(), false, now).text).toBe("Never used");
  expect(lastActive(agent({ status: "error" }), false, now).text).toBe("—");
});

test("masks the token wherever the snippet holds it", () => {
  const snippet = '{ "Authorization": "Bearer t0ken", "OPENMCP_TOKEN": "t0ken" }';
  expect(masked(snippet, "t0ken")).toBe('{ "Authorization": "Bearer ••••••••", "OPENMCP_TOKEN": "••••••••" }');
  expect(masked(snippet, undefined)).toBe(snippet);
});
