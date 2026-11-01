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
