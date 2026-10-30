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

export function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;

  return formatUptime(ms);
}

export const formatWhen = (at: Date, now = new Date()) =>
  at.toDateString() === now.toDateString() ? formatTime(at) : days.format(at);
