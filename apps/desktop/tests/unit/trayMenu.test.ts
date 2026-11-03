import type { MenuItemConstructorOptions } from "electron";
import { expect, test, vi } from "vitest";

import type { GatewayState } from "@openmcp/contracts";

import { trayMenu, trayTooltip, trayVariant, type TrayServer } from "../../src/main/trayMenu";

const dots = { running: "running", attention: "attention", error: "error", stopped: "stopped" };
const actions = { show: vi.fn(), quit: vi.fn(), copyUrl: vi.fn(), open: vi.fn(), act: vi.fn(), signIn: vi.fn() };
const running: GatewayState = { status: "running", port: 7465, error: null };
const servers: TrayServer[] = [
  { id: "a", name: "filesystem", status: "running" },
  { id: "b", name: "linear", status: "signin" },
  { id: "c", name: "fetch", status: "stopped" }
];

const labels = (items: MenuItemConstructorOptions[]) => items.map((item) => item.label ?? item.type);
const submenu = (item: MenuItemConstructorOptions) => item.submenu as MenuItemConstructorOptions[];

test("lists the gateway, each server with what it can do, and the app items", () => {
  const menu = trayMenu({ gateway: running, servers }, actions, dots, "win32");

  expect(labels(menu)).toEqual([
    "Gateway running on :7465",
    "separator",
    "Servers",
    "filesystem\tRunning",
    "linear\tNeeds sign-in",
    "fetch\tStopped",
    "separator",
    "Copy gateway URL",
    "Open OpenMCP",
    "separator",
    "Quit OpenMCP"
  ]);
  expect(labels(submenu(menu[3]))).toEqual(["Restart", "Stop", "separator", "Show in OpenMCP"]);
  expect(labels(submenu(menu[4]))).toEqual(["Sign in…", "separator", "Show in OpenMCP"]);
  expect(labels(submenu(menu[5]))).toEqual(["Start", "separator", "Show in OpenMCP"]);
  expect(menu[4].icon).toBe("attention");

  (submenu(menu[5])[0].click as () => void)();
  expect(actions.act).toHaveBeenCalledWith("c", "start");
});

test("puts the status in a sublabel on macOS", () => {
  const menu = trayMenu({ gateway: running, servers }, actions, dots, "darwin");
  expect(menu[3]).toMatchObject({ label: "filesystem", sublabel: "Running" });
});

test("flags servers that need you and a stopped gateway", () => {
  const stopped: GatewayState = { status: "error", port: 7465, error: "in use" };

  expect(trayVariant({ gateway: running, servers: [servers[0]] })).toBe("normal");
  expect(trayVariant({ gateway: running, servers })).toBe("attention");
  expect(trayVariant({ gateway: stopped, servers })).toBe("dimmed");
  expect(trayTooltip({ gateway: running, servers })).toBe("OpenMCP · linear needs sign-in");
  expect(trayTooltip({ gateway: stopped, servers })).toBe("OpenMCP · Gateway stopped");
  expect(trayMenu({ gateway: stopped, servers: [] }, actions, dots, "win32")[0].label).toBe("Gateway stopped");
});
