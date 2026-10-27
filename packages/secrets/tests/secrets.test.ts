import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";

import { deleteSecret, getSecret, setSecret } from "../src";

test("successfully round-trips a secret through the OS keyring", () => {
  const key = `test-${randomUUID()}`;

  try {
    setSecret(key, "test-secret-value");
    expect(getSecret(key)).toBe("test-secret-value");
  } finally {
    deleteSecret(key);
  }
  expect(getSecret(key)).toBeNull();
});