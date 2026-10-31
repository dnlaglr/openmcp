import { EnvName, HeaderName, NewCustomServer, type InstalledServer, type IpcInput } from "@openmcp/contracts";

// `stored` is the keychain name a secret row was loaded with. Stored values never reach the renderer.
export type EnvRow = { id: string; key: string; value: string; secret: boolean; stored: string | null };

// Both kinds' fields are kept, so switching tabs while adding doesn't lose what was typed.
export type ServerForm = {
  type: "stdio" | "http";
  name: string;
  command: string;
  args: string;
  env: EnvRow[];
  url: string;
  headers: EnvRow[];
  autostart: boolean;
};

export type ServerFormErrors = Partial<Record<"name" | "command" | "env" | "secrets" | "url" | "headers", string>>;

export type ParsedServerForm = { success: true; data: NewCustomServer } | { success: false; errors: ServerFormErrors };

export const emptyServerForm: ServerForm = {
  type: "stdio",
  name: "",
  command: "",
  args: "",
  env: [],
  url: "",
  headers: [],
  autostart: false
};

export const newEnvRow = (): EnvRow => ({ id: crypto.randomUUID(), key: "", value: "", secret: false, stored: null });

// Nearly every header a remote server asks for is an API key.
export const newHeaderRow = (): EnvRow => ({ ...newEnvRow(), secret: true });

export type VariableLabels = { legend: string; name: string; placeholder: string; add: string; remove: string };

export const envLabels: VariableLabels = {
  legend: "Environment variables",
  name: "Variable name",
  placeholder: "API_KEY",
  add: "Add variable",
  remove: "Remove variable"
};

export const headerLabels: VariableLabels = {
  legend: "Headers",
  name: "Header name",
  placeholder: "Authorization",
  add: "Add header",
  remove: "Remove header"
};

const rules = {
  stdio: {
    field: "env",
    name: EnvName,
    duplicate: "Each variable name can only be used once",
    invalidName: "Variable names use letters, numbers or _, and can't start with a number"
  },
  http: {
    field: "headers",
    name: HeaderName,
    duplicate: "Each header can only be set once",
    invalidName: "Header names use letters, numbers and -, with no spaces or colons"
  }
} as const;

const rowsOf = (form: ServerForm) => (form.type === "stdio" ? form.env : form.headers);

const isKept = (row: EnvRow): row is EnvRow & { stored: string } => row.secret && row.stored !== null && !row.value;

const unshownSecret = (rows: EnvRow[]) =>
  rows.find((row) => row.key.trim() && row.stored !== null && !row.secret && !row.value);

const loadRows = (plain: Record<string, string>, secret: string[]) => [
  ...Object.entries(plain).map(([key, value]) => ({ ...newEnvRow(), key, value })),
  ...secret.map((key) => ({ ...newEnvRow(), key, secret: true, stored: key }))
];

export function serverFormFrom({ name, launch, autostart }: InstalledServer): ServerForm {
  if (launch.type === "http") {
    const headers = loadRows(launch.headers, launch.secretHeaders);
    return { ...emptyServerForm, type: "http", name, url: launch.url, headers, autostart };
  }

  const env = loadRows(launch.env, launch.secretEnv);
  return { ...emptyServerForm, name, command: launch.command, args: launch.args.join("\n"), env, autostart };
}

export function keptSecrets(form: ServerForm): Record<string, string> {
  return Object.fromEntries(
    rowsOf(form)
      .filter(isKept)
      .filter((row) => row.key.trim())
      .map((row) => [row.key.trim(), row.stored])
  );
}

export function toNewCustomServer(form: ServerForm): IpcInput<"servers:addCustom"> {
  const remote = form.type === "http";
  const rows = rowsOf(form).filter((row) => row.key.trim() && !isKept(row));
  // Whitespace around a header value is never meant, and a pasted key often ends in a newline.
  const variables = (secret: boolean) =>
    Object.fromEntries(
      rows.filter((row) => row.secret === secret).map((row) => [row.key.trim(), remote ? row.value.trim() : row.value])
    );
  const common = { name: form.name.trim(), secrets: variables(true), autostart: form.autostart };

  if (remote) return { ...common, type: "http", url: form.url.trim(), headers: variables(false) };
  return {
    ...common,
    type: "stdio",
    command: form.command,
    args: form.args
      .split("\n")
      .map((arg) => arg.trim())
      .filter(Boolean),
    env: variables(false)
  };
}

// Rows become an object keyed by name, so a repeated name would silently drop a row. Header names ignore case.
function hasDuplicateNames(rows: EnvRow[], ignoreCase: boolean) {
  const names = rows
    .map((row) => row.key.trim())
    .filter(Boolean)
    .map((name) => (ignoreCase ? name.toLowerCase() : name));
  return new Set(names).size !== names.length;
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): ServerFormErrors {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[String(issue.path[0])] ??= issue.message;

  return errors;
}

export function parseServerForm(form: ServerForm): ParsedServerForm {
  const rule = rules[form.type];
  const rows = rowsOf(form);
  const result = NewCustomServer.safeParse(toNewCustomServer(form));
  const duplicateNames = hasDuplicateNames(rows, form.type === "http");
  const unshown = unshownSecret(rows);
  const invalidKeptName = Object.keys(keptSecrets(form)).some((name) => !rule.name.safeParse(name).success);

  if (result.success && !duplicateNames && !unshown && !invalidKeptName) return { success: true, data: result.data };

  const errors = result.success ? {} : fieldErrors(result.error.issues);
  if (duplicateNames) errors[rule.field] ??= rule.duplicate;
  if (invalidKeptName) errors[rule.field] ??= rule.invalidName;
  if (unshown) errors[rule.field] ??= `Enter a value for ${unshown.key.trim()}. Stored secrets aren't shown.`;

  return { success: false, errors };
}
