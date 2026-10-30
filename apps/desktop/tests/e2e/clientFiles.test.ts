import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { apply, inspect, type ClientContext } from "../../src/main/clients/files";
import { CLIENTS } from "../../src/main/clients/clients";

const cursor = CLIENTS.find((client) => client.id === "cursor")!;
const windows = process.platform === "win32";
let root: string | undefined;

afterEach(() => {
  vi.useRealTimers();
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

function setup() {
  root = mkdtempSync(join(tmpdir(), "openmcp-clients-"));
  const home = join(root, "home");
  mkdirSync(join(home, ".cursor"), { recursive: true });

  const context: ClientContext = {
    env: {
      platform: process.platform,
      home,
      appData: join(root, "appdata"),
      localAppData: undefined,
      packages: [],
      claudeConfigDir: undefined
    },
    name: "openmcp",
    bridge: { command: "openmcp", script: "bridge.js" },
    connection: { url: "http://127.0.0.1:7465/mcp", token: "first" },
    backups: join(root, "backups")
  };

  return { context, file: join(home, ".cursor", "mcp.json"), backups: join(root, "backups", "cursor") };
}

const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const withToken = (context: ClientContext, token: string) => ({
  ...context,
  connection: { ...context.connection, token }
});

test("connects, follows a new token and disconnects without touching other servers", async () => {
  const { context, file } = setup();
  writeFileSync(file, JSON.stringify({ mcpServers: { other: { command: "x" } } }));

  await apply(cursor, context, true);
  expect(read(file).mcpServers).toEqual({
    other: { command: "x" },
    openmcp: { url: context.connection.url, headers: { Authorization: "Bearer first" } }
  });
  expect(await inspect(cursor, context)).toMatchObject({ status: "connected", path: file, error: null });

  const rotated = withToken(context, "second");
  expect((await inspect(cursor, rotated)).status).toBe("outdated");
  await apply(cursor, rotated, true);
  expect(read(file).mcpServers.openmcp.headers).toEqual({ Authorization: "Bearer second" });

  await apply(cursor, rotated, false);
  expect(read(file)).toEqual({ mcpServers: { other: { command: "x" } } });
  expect((await inspect(cursor, rotated)).status).toBe("disconnected");
});

test("creates a missing config file that only the user can read", async () => {
  const { context, file, backups } = setup();

  await apply(cursor, context, true);

  expect(read(file).mcpServers.openmcp.url).toBe(context.connection.url);
  expect(existsSync(backups)).toBe(false);
  if (!windows) expect(statSync(file).mode & 0o777).toBe(0o600);
});

test("keeps the newest five backups, readable only by the user", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const { context, file, backups } = setup();
  writeFileSync(file, "{}");

  for (let second = 0; second < 7; second++) {
    vi.setSystemTime(Date.UTC(2026, 9, 29, 12, 0, second));
    await apply(cursor, withToken(context, `t${second}`), true);
  }

  const kept = readdirSync(backups).sort();
  expect(kept).toHaveLength(5);
  expect(kept[0]).toBe("2026-10-29T12-00-02.000Z.json");
  expect(read(join(backups, kept[4])).mcpServers.openmcp.headers.Authorization).toBe("Bearer t5");
  if (!windows) expect(statSync(join(backups, kept[4])).mode & 0o777).toBe(0o600);
});

test("doesn't rewrite or back up a file that is already right", async () => {
  const { context, file, backups } = setup();
  writeFileSync(file, "{}");
  await apply(cursor, context, true);
  const written = readFileSync(file, "utf8");

  await apply(cursor, context, true);
  await apply(cursor, { ...context, name: "absent" }, false);

  expect(readFileSync(file, "utf8")).toBe(written);
  expect(readdirSync(backups)).toHaveLength(1);
});

test("keeps a byte-order mark", async () => {
  const { context, file } = setup();
  writeFileSync(file, "\uFEFF{}");

  expect((await inspect(cursor, context)).status).toBe("disconnected");
  await apply(cursor, context, true);

  const text = readFileSync(file, "utf8");
  expect(text.startsWith("\uFEFF")).toBe(true);
  expect(JSON.parse(text.slice(1)).mcpServers.openmcp.url).toBe(context.connection.url);
});

test("refuses to write a file it can't parse", async () => {
  const { context, file, backups } = setup();
  writeFileSync(file, `{ "mcpServers": `);

  expect(await inspect(cursor, context)).toMatchObject({
    status: "error",
    error: expect.stringMatching(/^Syntax error on line 1/)
  });
  await expect(apply(cursor, context, true)).rejects.toThrow(`Fix ${file} first. Syntax error on line 1`);
  expect(readFileSync(file, "utf8")).toBe(`{ "mcpServers": `);
  expect(existsSync(backups)).toBe(false);
});

test("says a client is missing when its folder isn't there", async () => {
  const { context } = setup();
  rmSync(join(context.env.home, ".cursor"), { recursive: true });

  expect(await inspect(cursor, context)).toMatchObject({ status: "missing", path: null });
  await expect(apply(cursor, context, true)).rejects.toThrow("Cursor isn't installed on this computer.");
});

test.skipIf(windows)("keeps an existing file's mode", async () => {
  const { context, file } = setup();
  writeFileSync(file, "{}");
  chmodSync(file, 0o640);

  await apply(cursor, context, true);

  expect(statSync(file).mode & 0o777).toBe(0o640);
});

test.skipIf(windows)("edits the target of a symlinked config", async () => {
  const { context, file } = setup();
  const real = join(root!, "dotfiles-mcp.json");
  writeFileSync(real, "{}");
  symlinkSync(real, file);

  await apply(cursor, context, true);

  expect(lstatSync(file).isSymbolicLink()).toBe(true);
  expect(read(real).mcpServers.openmcp.url).toBe(context.connection.url);
});
