import { expect, test } from "vitest";

import { ipcErrorMessage } from "../../src/renderer/src/lib/ipc-error";

test("strips Electron's remote-method wrapper from errors thrown in main", () => {
  const error = new Error(`Error invoking remote method 'servers:addCustom': Error: A server named "github" already exists.`);

  expect(ipcErrorMessage(error)).toBe('A server named "github" already exists.');
});

test("leaves other messages untouched", () => {
  expect(ipcErrorMessage(new Error("Network down"))).toBe("Network down");
  expect(ipcErrorMessage("plain string")).toBe("plain string");
});
