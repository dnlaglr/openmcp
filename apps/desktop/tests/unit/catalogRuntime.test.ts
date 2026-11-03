import { expect, test } from "vitest";

import type { Runtimes } from "@openmcp/contracts";

import { checkRunner, RUNTIMES } from "../../src/renderer/features/catalog/runtimes";

const runtimes: Runtimes = {
  node: { found: true, version: "22.11.0" },
  uv: { found: false, version: null },
  docker: { found: true, version: null, running: false }
};

test("says whether each runner's runtime is ready", () => {
  expect(checkRunner("npx", runtimes)).toEqual({
    runner: "npx",
    info: RUNTIMES.npx,
    found: true,
    ready: true,
    version: "v22.11.0"
  });
  expect(checkRunner("uvx", runtimes)).toMatchObject({ found: false, ready: false, version: null });
  expect(checkRunner("docker", runtimes)).toMatchObject({ found: true, ready: false });
  expect(checkRunner("remote", runtimes)).toBeNull();
  expect(checkRunner("npx", undefined)).toBeNull();
});
