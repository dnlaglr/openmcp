import {
  inputErrors,
  isStoredSecret,
  secretNames,
  ServerName,
  storedName,
  type CatalogEntry,
  type InstalledServer,
  type IpcInput
} from "@openmcp/contracts";

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

// Plain values carry over from the current launch; stored secrets start blank, which keeps them.
export function initialUpdateValues(entry: CatalogEntry, server: InstalledServer): Record<string, string> {
  const names = secretNames(server.launch);
  const plain = server.launch.type === "stdio" ? server.launch.env : server.launch.headers;

  return Object.fromEntries(
    entry.inputs.map((input) => {
      if (isStoredSecret(input, names)) return [input.id, ""];

      const name = storedName(input);
      return [input.id, (name === null ? undefined : plain[name]) ?? input.default ?? ""];
    })
  );
}

export function updateFormErrors(entry: CatalogEntry, server: InstalledServer, values: Record<string, string>) {
  const inputs = entry.inputs.map((input) =>
    isStoredSecret(input, secretNames(server.launch)) ? { ...input, required: false } : input
  );
  return inputErrors(inputs, values);
}
