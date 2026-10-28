import { NewCustomServer, type IpcInput } from "@openmcp/contracts";

export type EnvRow = { id: string; key: string; value: string; secret: boolean };

export type ServerForm = {
  name: string;
  command: string;
  args: string;
  env: EnvRow[];
  autostart: boolean;
};

export type ServerFormErrors = Partial<Record<keyof IpcInput<"servers:addCustom">, string>>;

export type ParsedServerForm =
  | { success: true; data: NewCustomServer }
  | { success: false; errors: ServerFormErrors };

export const emptyServerForm: ServerForm = { name: "", command: "", args: "", env: [], autostart: false };

export const newEnvRow = (): EnvRow => ({ id: crypto.randomUUID(), key: "", value: "", secret: false });


export function toNewCustomServer(form: ServerForm): IpcInput<"servers:addCustom"> {
  const rows = form.env.filter((row) => row.key.trim());
  const variables = (secret: boolean) =>
    Object.fromEntries(rows.filter((row) => row.secret === secret).map((row) => [row.key.trim(), row.value]));

  return {
    name: form.name.trim(),
    command: form.command,
    args: form.args.split("\n").map((arg) => arg.trim()).filter(Boolean),
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

  if (result.success && !duplicateNames) return { success: true, data: result.data };

  const errors = result.success ? {} : fieldErrors(result.error.issues);
  if (duplicateNames) errors.env ??= "Each variable name can only be used once";

  return { success: false, errors };
}
