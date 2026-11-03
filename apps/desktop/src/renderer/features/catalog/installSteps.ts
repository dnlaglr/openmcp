import type { ServerStatus } from "@openmcp/contracts";

export type StepStatus = "wait" | "busy" | "done" | "fail";
export type Step = { title: string; note?: string; error?: string; status: StepStatus };

export type Progress = {
  name: string;
  command: string;
  secrets: boolean;
  saved: boolean;
  status?: ServerStatus;
  pid?: number | null;
  failure: string | null;
  tools?: number;
};

export function installSteps(progress: Progress): Step[] {
  const saved: Step = {
    title: `Saved ${progress.name}`,
    note: progress.secrets ? "Secrets are in your keychain" : "Added to your servers",
    status: progress.saved ? "done" : "busy"
  };
  const ready: Step = { title: "Ready for your agents", status: "wait" };

  if (!progress.saved) return [saved, { title: "Starting", status: "wait" }, ready];
  if (progress.failure)
    return [
      saved,
      { title: "Couldn’t start", error: progress.failure, status: "fail" },
      { ...ready, note: "Check its settings, then start it again." }
    ];

  const started: Step = {
    title: "Started",
    note: progress.pid ? `Process ${progress.pid}` : undefined,
    status: "done"
  };
  if (progress.status === "signin")
    return [
      saved,
      started,
      { title: "Waiting for you to sign in", note: "Your browser opened its sign-in page.", status: "busy" }
    ];
  if (progress.status !== "running")
    return [saved, { title: "Starting", note: progress.command, status: "busy" }, ready];
  if (progress.tools === undefined) return [saved, started, { ...ready, status: "busy" }];

  const tools = `${progress.tools} ${progress.tools === 1 ? "tool" : "tools"}`;
  return [
    saved,
    started,
    { title: `Running · ${tools} ready`, note: "Every connected agent can use them now.", status: "done" }
  ];
}
