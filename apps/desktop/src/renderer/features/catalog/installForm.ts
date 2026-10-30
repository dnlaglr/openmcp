import { inputErrors, ServerName, type CatalogEntry, type IpcInput } from "@openmcp/contracts";

export type InstallForm = { name: string; values: Record<string, string>; autostart: boolean };

// Keyed by "name" or a CatalogInput id ("env:…", "arg:…"), which never collide.
export type InstallFormErrors = Record<string, string>;

export function initialInstallForm(entry: CatalogEntry): InstallForm {
  return {
    name: entry.defaultName,
    values: Object.fromEntries(entry.inputs.map((input) => [input.id, input.default ?? ""])),
    autostart: true
  };
}

export function installFormErrors(entry: CatalogEntry, form: InstallForm): InstallFormErrors {
  const errors = inputErrors(entry.inputs, form.values);

  const name = ServerName.safeParse(form.name.trim());
  if (!name.success) errors.name = name.error.issues[0].message;

  return errors;
}

export function toInstallInput(entry: CatalogEntry, form: InstallForm): IpcInput<"catalog:install"> {
  return {
    registryName: entry.name,
    version: entry.version,
    name: form.name.trim(),
    values: form.values,
    autostart: form.autostart
  };
}
