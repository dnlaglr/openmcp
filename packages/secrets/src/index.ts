import { Entry } from "@napi-rs/keyring";

const SERVICE_NAME = "openmcp";

// Windows caps an entry at 1,280 UTF-16 units, so longer values span `key`, `key:1`, `key:2`…
// Secret names never contain ":", so a part's key can't be another secret's.
const PARTS = /[\s\S]{1,600}/gu;

const entry = (key: string, part: number) => new Entry(SERVICE_NAME, part === 0 ? key : `${key}:${part}`);

function deleteParts(key: string, from: number) {
  let deleted = false;
  for (let part = from; entry(key, part).deletePassword(); part++) deleted = true;
  return deleted;
}

export function getSecret(key: string): string | null {
  let value = entry(key, 0).getPassword();
  if (value === null) return null;

  for (let part = 1; ; part++) {
    const next = entry(key, part).getPassword();
    if (next === null) return value;
    value += next;
  }
}

export function setSecret(key: string, value: string): void {
  const parts = value.match(PARTS) ?? [""];
  parts.forEach((part, index) => entry(key, index).setPassword(part));
  deleteParts(key, parts.length);
}

export function deleteSecret(key: string): boolean {
  return deleteParts(key, 0);
}
