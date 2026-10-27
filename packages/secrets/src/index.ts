import { Entry } from "@napi-rs/keyring";

const SERVICE_NAME = "openmcp";


export function getSecret(key: string): string | null {
  return new Entry(SERVICE_NAME, key).getPassword();
}


export function setSecret(key: string, value: string): void {
  new Entry(SERVICE_NAME, key).setPassword(value);
}


export function deleteSecret(key: string): boolean {
  return new Entry(SERVICE_NAME, key).deletePassword();
}