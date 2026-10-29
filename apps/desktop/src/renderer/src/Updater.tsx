import { useEffect, useState } from "react";

import type { UpdateStatus } from "@openmcp/contracts";

import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const version = new URLSearchParams(location.search).get("version");


export function Updater() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  useEffect(() => window.updater.onStatus(setStatus), []);

  function update() {
    setStatus({ state: "downloading", percent: 0 });
    window.updater.choose("update");
  }

  return (
    <main className="flex flex-col justify-center items-center h-screen text-center gap-6 p-8 select-none [-webkit-app-region:drag]">
      <div className="flex justify-center items-center size-20 text-primary-foreground bg-primary rounded-2xl">
        <Logo className="size-10" />
      </div>

      {status ? (
        <Progress value={status.state === "installing" ? 100 : status.percent} className="w-full">
          <ProgressLabel>{status.state === "installing" ? "Installing update…" : "Downloading update…"}</ProgressLabel>
          {status.state === "downloading" && <ProgressValue />}
        </Progress>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="font-semibold">Update available</h1>
            <p className="text-sm text-muted-foreground">OpenMCP version {version} is available. Would you like to update?</p>
          </div>
          <div className="flex flex-col w-full gap-2 [-webkit-app-region:no-drag]">
            <Button size="lg" onClick={update}>Update</Button>
            <Button size="lg" variant="ghost" onClick={() => window.updater.choose("continue")}>Continue to OpenMCP</Button>
          </div>
        </>
      )}
    </main>
  );
}
