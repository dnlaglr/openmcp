import type { ActivityRange } from "@openmcp/contracts";

import { formatTime, formatUptime } from "../servers/serverDetails";

const counts = new Intl.NumberFormat();
const rates = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });
const days = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

export const formatCount = (count: number) => counts.format(count);

export const formatRate = (failures: number, calls: number) => rates.format(calls === 0 ? 0 : failures / calls);

export function formatAgo(at: Date, now = Date.now()) {
  const minutes = Math.round((now - at.getTime()) / 60_000);
  if (now - at.getTime() < 45_000) return "just now";
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;

  return formatUptime(ms);
}

export const formatWhen = (at: Date, now = new Date()) =>
  at.toDateString() === now.toDateString() ? formatTime(at) : days.format(at);

const compact = new Intl.NumberFormat(undefined, { notation: "compact" });
const hourMinute = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const monthDay = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export const formatCompact = (count: number) => compact.format(count);

export const RANGES: Record<ActivityRange, { words: string; bucket: string; axis: [string, string, string] }> = {
  "1h": { words: "last hour", bucket: "1 bar = 1 minute", axis: ["60 min ago", "30 min ago", "Now"] },
  "24h": { words: "last 24 hours", bucket: "1 bar = 30 minutes", axis: ["24 h ago", "12 h ago", "Now"] },
  "7d": { words: "last 7 days", bucket: "1 bar = 4 hours", axis: ["7 days ago", "3½ days ago", "Now"] },
  "30d": { words: "last 30 days", bucket: "1 bar = 1 day", axis: ["30 days ago", "15 days ago", "Now"] }
};

export function bucketWindow(at: Date, ms: number) {
  const end = new Date(at.getTime() + ms);
  const hours = `${hourMinute.format(at)}–${hourMinute.format(end)}`;

  if (ms >= 24 * 3_600_000) return monthDay.format(at);
  if (ms >= 4 * 3_600_000) return `${monthDay.format(at)} ${hours}`;
  return hours;
}
