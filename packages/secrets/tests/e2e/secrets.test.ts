import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";

import { deleteSecret, getSecret, setSecret } from "../../src";

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

function withKey(run: (key: string) => void) {
  const key = `test-${randomUUID()}`;
  try {
    run(key);
  } finally {
    deleteSecret(key);
  }
}

test("stores a value longer than one keychain entry holds", () =>
  withKey((key) => {
    const value = "x".repeat(5_000);
    setSecret(key, value);
    expect(getSecret(key)).toBe(value);
  }));

test("keeps characters outside the BMP intact across parts", () =>
  withKey((key) => {
    const value = "😀".repeat(1_500);
    setSecret(key, value);
    expect(getSecret(key)).toBe(value);
  }));

test("leaves no parts behind when a long value is replaced by a short one", () =>
  withKey((key) => {
    setSecret(key, "x".repeat(5_000));
    setSecret(key, "short");
    expect(getSecret(key)).toBe("short");
    expect(getSecret(`${key}:1`)).toBeNull();
  }));

test("deletes every part of a long value", () => {
  const key = `test-${randomUUID()}`;
  setSecret(key, "x".repeat(5_000));

  expect(deleteSecret(key)).toBe(true);
  expect(getSecret(key)).toBeNull();
  expect(getSecret(`${key}:1`)).toBeNull();
});
