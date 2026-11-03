import { applyEdits, modify, parse, printParseErrorCode, type ParseError } from "jsonc-parser";
import { parse as parseToml, patch as patchToml } from "@decimalturn/toml-patch";
import { isDeepStrictEqual } from "node:util";

import type { ClientStatus } from "@openmcp/contracts";

export type ConfigFormat = "json" | "toml";

type Read = { entry: unknown } | { error: string };
type Root = { root: unknown } | { error: string };
type StatusInput = {
  format: ConfigFormat;
  dirExists: boolean;
  text: string | null;
  key: string;
  name: string;
  expected: unknown;
};

const TOML_FORMAT = { inlineTableStart: 2 };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const lineOf = (text: string, offset: number) => text.slice(0, offset).split("\n").length;

const eolOf = (text: string) => (text.includes("\r\n") ? "\r\n" : "\n");

const formatting = (text: string) => ({ insertSpaces: true, tabSize: 2, eol: eolOf(text) });

function jsonRoot(text: string): Root {
  const errors: ParseError[] = [];
  const root: unknown = parse(text, errors, { allowTrailingComma: true, allowEmptyContent: true });

  const [first] = errors;
  if (first)
    return { error: `Syntax error on line ${lineOf(text, first.offset)} (${printParseErrorCode(first.error)}).` };
  return { root };
}

function tomlRoot(text: string): Root {
  try {
    // toml-patch returns null-prototype objects, which isDeepStrictEqual never matches.
    return { root: structuredClone(parseToml(text)) };
  } catch (error) {
    if (!(error instanceof Error && "line" in error)) throw error;
    return { error: `Syntax error on line ${String(error.line)} (${error.message.split("\n").at(-1)}).` };
  }
}

export function readEntry(format: ConfigFormat, text: string, key: string, name: string): Read {
  const read = format === "toml" ? tomlRoot(text) : jsonRoot(text);
  if ("error" in read) return read;
  if (read.root === undefined) return { entry: undefined };
  if (!isObject(read.root)) return { error: "The file doesn't hold a JSON object." };

  const servers = read.root[key];
  if (servers === undefined) return { entry: undefined };
  if (!isObject(servers)) return { error: `"${key}" isn't a ${format === "toml" ? "table" : "JSON object"}.` };

  return { entry: servers[name] };
}

function setToml(text: string, key: string, name: string, entry: unknown) {
  const root = parseToml(text);
  const updated = { ...root, [key]: { ...root[key], [name]: entry } };
  if (root[key]?.[name] !== undefined) return patchToml(text, updated, TOML_FORMAT);

  // Without a header of its own, toml-patch adds the entry as a dotted key at the top of the file.
  const eol = eolOf(text);
  const seeded = `${text.trimEnd()}${text.trim() ? eol + eol : ""}[${key}.${name}]${eol}`;
  try {
    return patchToml(seeded, updated, TOML_FORMAT);
  } catch {
    return patchToml(text, updated, TOML_FORMAT);
  }
}

export function setEntry(format: ConfigFormat, text: string, key: string, name: string, entry: unknown) {
  if (format === "toml") return setToml(text, key, name, entry);

  // Inserting first keeps jsonc-parser from reformatting the previous sibling's line.
  return applyEdits(
    text,
    modify(text, [key, name], entry, { formattingOptions: formatting(text), getInsertionIndex: () => 0 })
  );
}

export function removeEntry(format: ConfigFormat, text: string, key: string, name: string) {
  const read = readEntry(format, text, key, name);
  if ("entry" in read && read.entry === undefined) return text;

  if (format === "toml") {
    const root = parseToml(text);
    delete root[key][name];
    return patchToml(text, root, TOML_FORMAT);
  }

  return applyEdits(text, modify(text, [key, name], undefined, { formattingOptions: formatting(text) }));
}

export function statusOf({ format, dirExists, text, key, name, expected }: StatusInput): {
  status: ClientStatus;
  error: string | null;
} {
  if (!dirExists) return { status: "missing", error: null };
  if (text === null) return { status: "disconnected", error: null };

  const read = readEntry(format, text, key, name);
  if ("error" in read) return { status: "error", error: read.error };
  if (read.entry === undefined) return { status: "disconnected", error: null };

  return { status: isDeepStrictEqual(read.entry, expected) ? "connected" : "outdated", error: null };
}
