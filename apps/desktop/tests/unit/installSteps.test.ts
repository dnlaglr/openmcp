import { expect, test } from "vitest";

import { installSteps } from "../../src/renderer/features/catalog/installSteps";

const base = { name: "e2e", command: "npx -y e2e@1.0.0", secrets: true, failure: null };

test("walks from saved to ready", () => {
  expect(installSteps({ ...base, saved: false }).map((step) => step.status)).toEqual(["busy", "wait", "wait"]);
  expect(installSteps({ ...base, saved: true, status: "starting" })[1]).toEqual({
    title: "Starting",
    note: "npx -y e2e@1.0.0",
    status: "busy"
  });
  expect(installSteps({ ...base, saved: true, status: "running", pid: 42, tools: 1 })).toEqual([
    { title: "Saved e2e", note: "Secrets are in your keychain", status: "done" },
    { title: "Started", note: "Process 42", status: "done" },
    { title: "Running · 1 tool ready", note: "Every connected agent can use them now.", status: "done" }
  ]);
});

test("waits for the tool list before saying it's ready", () => {
  expect(installSteps({ ...base, saved: true, status: "running", pid: 42 })[2].status).toBe("busy");
});

test("stops at the first failure", () => {
  const steps = installSteps({ ...base, saved: true, status: "starting", failure: "Process exited with code 1" });

  expect(steps.map((step) => step.status)).toEqual(["done", "fail", "wait"]);
  expect(steps[1]).toMatchObject({ title: "Couldn’t start", error: "Process exited with code 1" });
  expect(steps[2].note).toBe("Check its settings, then start it again.");
});
