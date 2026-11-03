import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { afterEach, expect, test } from "vitest";
import { delimiter, join } from "node:path";
import { tmpdir } from "node:os";

import { loadShellPath, mergePath } from "../../src/main/system/shellPath";

const saved = { PATH: process.env.PATH, SHELL: process.env.SHELL };
afterEach(() => Object.assign(process.env, saved));

test("puts the shell's entries first and keeps the rest once", () => {
  const list = (...parts: string[]) => parts.join(delimiter);
  expect(mergePath(list("/opt/homebrew/bin", "/usr/bin"), list("/usr/bin", "/bin"))).toBe(
    list("/opt/homebrew/bin", "/usr/bin", "/bin")
  );
});

test.skipIf(process.platform === "win32")("adopts the login shell's PATH over launchd's bare one", async () => {
  const dir = await mkdtemp(join(tmpdir(), "openmcp-shell-"));
  const shell = join(dir, "fake-shell");
  await writeFile(shell, '#!/bin/sh\nPATH="/from/profile:$PATH"\necho "welcome back"\neval "$2"\necho bye\n');
  await chmod(shell, 0o755);

  process.env.PATH = "/usr/bin:/bin";
  process.env.SHELL = shell;

  await loadShellPath();
  expect(process.env.PATH).toBe("/from/profile:/usr/bin:/bin");
});
