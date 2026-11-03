import { expect, test } from "vitest";

import { parseVersion, probe, toDocker, toRuntime } from "../../src/main/system/runtimes";

test("reads versions from each tool's output", () => {
  expect(parseVersion("v22.11.0\n")).toBe("22.11.0");
  expect(parseVersion("uv 0.8.13 (3c8a6ef 2025-08-21)")).toBe("0.8.13");
  expect(parseVersion("28.4.0\n")).toBe("28.4.0");
  expect(parseVersion("command not found")).toBeNull();
});

test("tells a Docker that isn't running from a missing one", () => {
  expect(toDocker({ status: "ok", stdout: "28.4.0\n" })).toEqual({ found: true, version: "28.4.0", running: true });
  expect(toDocker({ status: "failed", stdout: "" })).toEqual({ found: true, version: null, running: false });
  expect(toDocker({ status: "missing", stdout: "" })).toEqual({ found: false, version: null, running: false });
});

test("a missing or hanging command is not found", async () => {
  const missing = await probe("openmcp-no-such-runtime", ["--version"]);
  expect(missing.status).toBe("missing");
  expect(toRuntime(missing)).toEqual({ found: false, version: null });

  const started = Date.now();
  const hanging = await probe(process.execPath, ["-e", "setTimeout(() => {}, 10_000)"], 300);
  expect(hanging.status).toBe("timeout");
  expect(toRuntime(hanging)).toEqual({ found: false, version: null });
  expect(toDocker(hanging)).toEqual({ found: false, version: null, running: false });
  expect(Date.now() - started).toBeLessThan(3000);
});
