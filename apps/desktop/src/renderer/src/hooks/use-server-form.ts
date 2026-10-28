import { useState } from "react";

import { emptyServerForm, parseServerForm, type ServerForm, type ServerFormErrors } from "@/lib/server-form";


export function useServerForm() {
  const [form, setForm] = useState<ServerForm>(emptyServerForm);
  const [errors, setErrors] = useState<ServerFormErrors>({});

  // Editing a field clears its error, so stale messages don't linger until the next submit.
  function update(patch: Partial<ServerForm>) {
    const edited = new Set<string>(Object.keys(patch));
    if (edited.has("env")) edited.add("secrets");

    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([field]) => !edited.has(field))));
  }

  function validate() {
    const result = parseServerForm(form);
    setErrors(result.success ? {} : result.errors);

    return result.success ? result.data : null;
  }

  function reset() {
    setForm(emptyServerForm);
    setErrors({});
  }

  return { form, errors, update, validate, reset };
}
