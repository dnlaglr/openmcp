import { applyEdits, modify, parse, printParseErrorCode, type ParseError } from "jsonc-parser";
import { isDeepStrictEqual } from "node:util";

import type { ClientStatus } from "@openmcp/contracts";

type Read = { entry: unknown } | { error: string };
type StatusInput = { dirExists: boolean; text: string | null; key: string; name: string; expected: unknown };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const lineOf = (text: string, offset: number) => text.slice(0, offset).split("\n").length;

const formatting = (text: string) => ({ insertSpaces: true, tabSize: 2, eol: text.includes("\r\n") ? "\r\n" : "\n" });

export function readEntry(text: string, key: string, name: string): Read {
  const errors: ParseError[] = [];
  const root: unknown = parse(text, errors, { allowTrailingComma: true, allowEmptyContent: true });

  const [first] = errors;
  if (first)
    return { error: `Syntax error on line ${lineOf(text, first.offset)} (${printParseErrorCode(first.error)}).` };
  if (root === undefined) return { entry: undefined };
  if (!isObject(root)) return { error: "The file doesn't hold a JSON object." };

  const servers = root[key];
  if (servers === undefined) return { entry: undefined };
  if (!isObject(servers)) return { error: `"${key}" isn't a JSON object.` };

  return { entry: servers[name] };
}

export function setEntry(text: string, key: string, name: string, entry: unknown) {
  // Inserting first keeps jsonc-parser from reformatting the previous sibling's line.
  return applyEdits(
    text,
    modify(text, [key, name], entry, { formattingOptions: formatting(text), getInsertionIndex: () => 0 })
  );
}

export function removeEntry(text: string, key: string, name: string) {
  const read = readEntry(text, key, name);
  if ("entry" in read && read.entry === undefined) return text;

  return applyEdits(text, modify(text, [key, name], undefined, { formattingOptions: formatting(text) }));
}

export function statusOf({ dirExists, text, key, name, expected }: StatusInput): {
  status: ClientStatus;
  error: string | null;
} {
  if (!dirExists) return { status: "missing", error: null };
  if (text === null) return { status: "disconnected", error: null };

  const read = readEntry(text, key, name);
  if ("error" in read) return { status: "error", error: read.error };
  if (read.entry === undefined) return { status: "disconnected", error: null };

  return { status: isDeepStrictEqual(read.entry, expected) ? "connected" : "outdated", error: null };
}
