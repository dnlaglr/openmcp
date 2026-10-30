import { NewCustomServer, type InstalledServer, type IpcInput } from "@openmcp/contracts";

// `stored` is the keychain name a secret row was loaded with. Stored values never reach the renderer.
export type EnvRow = { id: string; key: string; value: string; secret: boolean; stored: string | null };

export type ServerForm = {
  name: string;
  command: string;
  args: string;
  env: EnvRow[];
  autostart: boolean;
};

export type ServerFormErrors = Partial<Record<keyof IpcInput<"servers:addCustom">, string>>;

export type ParsedServerForm = { success: true; data: NewCustomServer } | { success: false; errors: ServerFormErrors };

export const emptyServerForm: ServerForm = { name: "", command: "", args: "", env: [], autostart: false };

export const newEnvRow = (): EnvRow => ({ id: crypto.randomUUID(), key: "", value: "", secret: false, stored: null });

const isKept = (row: EnvRow): row is EnvRow & { stored: string } => row.secret && row.stored !== null && !row.value;

const unshownSecret = (rows: EnvRow[]) =>
  rows.find((row) => row.key.trim() && row.stored !== null && !row.secret && !row.value);

export function serverFormFrom({ name, launch, autostart }: InstalledServer): ServerForm {
  return {
    name,
    command: launch.command,
    args: launch.args.join("\n"),
    env: [
      ...Object.entries(launch.env).map(([key, value]) => ({ ...newEnvRow(), key, value })),
      ...launch.secretEnv.map((key) => ({ ...newEnvRow(), key, secret: true, stored: key }))
    ],
    autostart
  };
}

export function keptSecrets(form: ServerForm): Record<string, string> {
  return Object.fromEntries(
    form.env
      .filter(isKept)
      .filter((row) => row.key.trim())
      .map((row) => [row.key.trim(), row.stored])
  );
}

export function toNewCustomServer(form: ServerForm): IpcInput<"servers:addCustom"> {
  const rows = form.env.filter((row) => row.key.trim() && !isKept(row));
  const variables = (secret: boolean) =>
    Object.fromEntries(rows.filter((row) => row.secret === secret).map((row) => [row.key.trim(), row.value]));

  return {
    name: form.name.trim(),
    command: form.command,
    args: form.args
      .split("\n")
      .map((arg) => arg.trim())
      .filter(Boolean),
    env: variables(false),
    secrets: variables(true),
    autostart: form.autostart
  };
}

// Rows become an object keyed by name, so a repeated name would silently drop a row.
function hasDuplicateNames(rows: EnvRow[]) {
  const names = rows.map((row) => row.key.trim()).filter(Boolean);
  return new Set(names).size !== names.length;
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): ServerFormErrors {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[String(issue.path[0])] ??= issue.message;

  return errors;
}

export function parseServerForm(form: ServerForm): ParsedServerForm {
  const result = NewCustomServer.safeParse(toNewCustomServer(form));
  const duplicateNames = hasDuplicateNames(form.env);
  const unshown = unshownSecret(form.env);

  if (result.success && !duplicateNames && !unshown) return { success: true, data: result.data };

  const errors = result.success ? {} : fieldErrors(result.error.issues);
  if (duplicateNames) errors.env ??= "Each variable name can only be used once";
  if (unshown) errors.env ??= `Enter a value for ${unshown.key.trim()}. Stored secrets aren't shown.`;

  return { success: false, errors };
}
