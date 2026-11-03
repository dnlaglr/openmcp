import type { ClientId, ClientState, ClientStatus, ServerStatus } from "@openmcp/contracts";

import { formatAgo } from "../activity/activityFormat";

export const ACTIVE_MS = 120_000;

export const monograms: Record<ClientId, string> = {
  "claude-desktop": "CD",
  "claude-code": "CC",
  cursor: "Cu",
  vscode: "VS"
};

const statuses: Record<ClientStatus, { label: string; led: ServerStatus }> = {
  missing: { label: "Not installed", led: "stopped" },
  disconnected: { label: "Not connected", led: "stopped" },
  connected: { label: "Connected", led: "running" },
  outdated: { label: "Out of date", led: "signin" },
  error: { label: "Can’t read config", led: "error" }
};

export type LastActive = { text: string; tone: "live" | "waiting" | "muted" };

export const agentStatus = (client: ClientState, connecting: boolean) =>
  connecting ? { label: "Connecting", led: "starting" as const } : statuses[client.status];

export const isActiveNow = (client: ClientState, now: number) =>
  client.status === "connected" && client.lastSeenAt !== null && now - client.lastSeenAt.getTime() < ACTIVE_MS;

export const isWaiting = (client: ClientState, connectedAt: number | undefined) =>
  connectedAt !== undefined && client.status === "connected" && (client.lastSeenAt?.getTime() ?? 0) < connectedAt;

export function lastActive(client: ClientState, waiting: boolean, now: number): LastActive {
  if (client.status === "error") return { text: "—", tone: "muted" };
  if (waiting)
    return {
      text: client.id === "claude-desktop" ? "Restart it to finish" : "Waiting for its first call",
      tone: "waiting"
    };
  if (isActiveNow(client, now)) return { text: "Active now", tone: "live" };
  if (client.lastSeenAt) return { text: `Last call ${formatAgo(client.lastSeenAt, now)}`, tone: "muted" };
  return { text: "Never used", tone: "muted" };
}

export const masked = (text: string, token: string | undefined) => (token ? text.replaceAll(token, "••••••••") : text);
