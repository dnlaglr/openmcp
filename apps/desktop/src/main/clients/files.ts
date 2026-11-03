import { chmod, mkdir, readdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { extname, join } from "node:path";
import { existsSync } from "node:fs";

import type { ClientState, GatewayConnection } from "@openmcp/contracts";

import { snippet, type Bridge, type ClientDefinition, type ClientEnv, type Location } from "./clients";
import { readEntries, removeEntry, setEntry, statusOf } from "./config";

const KEEP_BACKUPS = 5;
const BOM = "\uFEFF";

export type ClientContext = {
  env: ClientEnv;
  name: string;
  bridge: Bridge;
  connection: GatewayConnection;
  backups: string;
};

export const pick = (locations: Location[]) =>
  locations.find(({ file }) => existsSync(file)) ?? locations.find(({ dir }) => existsSync(dir)) ?? locations[0];

async function readText(file: string) {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function backup(dir: string, text: string, ext: string) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${new Date().toISOString().replaceAll(":", "-")}${ext}`), text, { mode: 0o600 });

  const old = (await readdir(dir)).sort().slice(0, -KEEP_BACKUPS);
  await Promise.all(old.map((name) => rm(join(dir, name), { force: true })));
}

export async function inspect(
  client: ClientDefinition,
  context: ClientContext
): Promise<Omit<ClientState, "hint" | "lastSeenAt" | "backups">> {
  const { file, dir } = pick(client.locate(context.env));
  const expected = client.entry(context.connection, context.bridge);
  const found = existsSync(dir);
  const base = {
    id: client.id,
    name: client.name,
    path: found ? file : null,
    snippet: snippet(client, context.name, expected)
  };

  try {
    const text = found ? await readText(file) : null;
    const status = statusOf({
      format: client.format,
      dirExists: found,
      text: text?.replace(/^\uFEFF/, "") ?? null,
      key: client.key,
      name: context.name,
      expected
    });
    return { ...base, ...status };
  } catch (error) {
    return { ...base, status: "error", error: error instanceof Error ? error.message : String(error) };
  }
}

async function load(client: ClientDefinition, context: ClientContext) {
  const { file, dir } = pick(client.locate(context.env));
  if (!existsSync(dir)) throw new Error(`${client.name} isn't installed on this computer.`);

  const target = existsSync(file) ? await realpath(file) : file;
  const raw = await readText(target);
  const bom = raw?.startsWith(BOM) ? BOM : "";
  const text = (raw ?? "").slice(bom.length);

  const read = readEntries(client.format, text, client.key);
  if ("error" in read) throw new Error(`Fix ${file} first. ${read.error}`);
  return { file, target, raw, bom, text, entries: read.entries };
}

export const entriesOf = async (client: ClientDefinition, context: ClientContext) =>
  (await load(client, context)).entries;

export async function apply(client: ClientDefinition, context: ClientContext, connect: boolean, remove: string[] = []) {
  const { file, target, raw, bom, text, entries } = await load(client, context);

  const entry = connect ? client.entry(context.connection, context.bridge) : undefined;
  let next = remove.reduce((current, name) => removeEntry(client.format, current, client.key, name), text);
  if (!isDeepStrictEqual(entries[context.name], entry))
    next = entry
      ? setEntry(client.format, next, client.key, context.name, entry)
      : removeEntry(client.format, next, client.key, context.name);
  if (next === text) return;

  if (raw !== null) await backup(join(context.backups, client.id), raw, extname(file));

  const mode = raw === null ? 0o600 : (await stat(target)).mode & 0o777;
  const temp = `${target}.openmcp-tmp`;
  await writeFile(temp, bom + next, { mode });
  await chmod(temp, mode);
  await rename(temp, target);
}

export async function countBackups(dir: string) {
  try {
    return (await readdir(dir)).length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}
