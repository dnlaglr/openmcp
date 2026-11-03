import { useState } from "react";
import { cn } from "cn";

import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { RELEASES_URL, restartToUpdate } from "@/lib/updates";
import { useUpdateState } from "@/hooks/useUpdateState";
import { Button } from "./Button";
import { Logo } from "./Logo";

const day = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export function UpdateItem({ className }: { className: string }) {
  const { data: update } = useUpdateState();
  const [open, setOpen] = useState(false);

  if (!update || update.status === "idle") return null;

  if (update.status === "downloading")
    return (
      <span className={className}>
        <span
          aria-hidden
          className="size-3 rounded-full"
          style={{ background: `conic-gradient(var(--primary) ${update.percent}%, var(--tint-3) 0)` }}
        />
        Downloading {update.version} · {update.percent}%
      </span>
    );

  const manual = update.status === "manual";
  const released = update.releasedAt ? `released ${day.format(update.releasedAt)}` : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button type="button" className={cn(className, "text-primary hover:bg-tint-2")} />}>
        <span aria-hidden className="size-1.5 rounded-full bg-primary" />
        Version {update.version} is {manual ? "available" : "ready"}
      </PopoverTrigger>
      <PopoverContent className="flex w-[300px] flex-col gap-3">
        <div className="flex items-start gap-2.5">
          <span className="bevel-primary grid size-8 shrink-0 place-items-center rounded-lg">
            <Logo className="size-4" />
          </span>
          <div>
            <b className="font-semibold">OpenMCP {update.version}</b>
            <p className="text-xs text-muted-foreground">
              {[manual ? null : "Downloaded", released].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {update.notes.length > 0 && (
          <ul className="flex list-disc flex-col gap-1 pl-4 text-xs">
            {update.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
        {manual && (
          <p className="text-xs text-muted-foreground">
            This build can’t update itself on macOS. Download the new version from GitHub.
          </p>
        )}
        <div className="flex items-center gap-2">
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-primary hover:underline"
          >
            Release notes
          </a>
          <Button size="sm" className="ml-auto" onClick={() => setOpen(false)}>
            Later
          </Button>
          {manual ? (
            <Button size="sm" variant="primary" onClick={() => void window.api.invoke("updater:install")}>
              Download
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={restartToUpdate}>
              Restart to update
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
