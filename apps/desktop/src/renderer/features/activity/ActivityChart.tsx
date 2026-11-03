import { cn } from "cn";

import { ACTIVITY_BUCKETS, type ActivityBucket, type ActivityRange } from "@openmcp/contracts";

import { bucketWindow, formatCompact, formatCount, RANGES } from "./activityFormat";

const caption = "text-[11px] font-semibold text-muted-foreground";
const grow = "transition-[height] duration-(--d4) ease-(--ease-move)";

function tipAlign(index: number, count: number) {
  if (index < 4) return "left-0";
  if (index > count - 5) return "right-0";
  return "left-1/2 -translate-x-1/2";
}

type ActivityChartProps = { range: ActivityRange; buckets?: ActivityBucket[]; onConnect: () => void };

export function ActivityChart({ range, buckets = [], onConnect }: ActivityChartProps) {
  const copy = RANGES[range];
  const { ms } = ACTIVITY_BUCKETS[range];
  const calls = buckets.reduce((sum, bucket) => sum + bucket.calls, 0);
  const failures = buckets.reduce((sum, bucket) => sum + bucket.failures, 0);
  const top = Math.max(4, Math.ceil(Math.max(0, ...buckets.map((bucket) => bucket.calls)) / 4) * 4);
  const quiet = buckets.length > 0 && calls === 0;

  return (
    <section className="flex flex-col gap-2.5 rounded-[10px] p-4 ring-1 ring-border">
      <div className="flex items-center gap-4">
        <h3 className={caption}>Calls over time</h3>
        <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px] bg-primary" />
            Succeeded
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px] bg-destructive" />
            Failed
          </span>
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{copy.bucket}</span>
      </div>

      <div className="relative grid h-[150px] grid-cols-[32px_minmax(0,1fr)] gap-2">
        <div aria-hidden className="relative text-right text-[10.5px] text-muted-foreground tabular-nums">
          {[top, top / 2, 0].map((value, index) => (
            <span key={index} className="absolute right-0 -translate-y-1/2" style={{ top: `${index * 50}%` }}>
              {formatCompact(value)}
            </span>
          ))}
        </div>
        <div
          role="img"
          aria-label={`${formatCount(calls)} calls in the ${copy.words}, ${formatCount(failures)} failed`}
          className="relative"
        >
          {[0, 50, 100].map((offset) => (
            <span
              key={offset}
              aria-hidden
              className="absolute inset-x-0 border-t border-dashed border-border"
              style={{ top: `${offset}%` }}
            />
          ))}
          <div className="absolute inset-0 flex origin-bottom animate-[grow-up_var(--d4)_var(--ease-out)_both] items-end gap-[2px]">
            {buckets.map((bucket, index) => (
              <span key={index} className="group relative flex h-full flex-1 flex-col justify-end">
                <span
                  className={cn("rounded-t-[2px] bg-destructive", grow)}
                  style={{ height: `${(bucket.failures / top) * 100}%` }}
                />
                <span
                  className={cn("rounded-t-[2px] bg-primary group-hover:brightness-110", grow)}
                  style={{ height: `${((bucket.calls - bucket.failures) / top) * 100}%` }}
                />
                <span
                  className={cn(
                    "pointer-events-none absolute bottom-full z-10 mb-1.5 hidden flex-col rounded-md bg-popover px-2 py-1 text-[11px] whitespace-nowrap shadow-md ring-1 ring-border group-hover:flex",
                    tipAlign(index, buckets.length)
                  )}
                >
                  <b className="font-semibold">{bucketWindow(bucket.at, ms)}</b>
                  {formatCount(bucket.calls)} calls{bucket.failures ? ` · ${formatCount(bucket.failures)} failed` : ""}
                </span>
              </span>
            ))}
          </div>
        </div>
        {quiet && (
          <div className="absolute inset-y-0 right-0 left-10 flex animate-up flex-col items-center justify-center gap-1 text-center">
            <b className="font-semibold">No calls in the {copy.words}</b>
            <span className="text-xs text-muted-foreground">Calls show up here as your agents make them.</span>
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={onConnect}>
              Connect an agent →
            </button>
          </div>
        )}
      </div>

      <div aria-hidden className="ml-10 flex justify-between text-[10.5px] text-muted-foreground">
        {copy.axis.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </section>
  );
}
