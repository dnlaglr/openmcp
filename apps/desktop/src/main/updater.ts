import { app, BrowserWindow, ipcMain, shell } from "electron";
import electronUpdater from "electron-updater";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { UpdateStatus } from "@openmcp/contracts";

import { createWindow } from "./windows";

const { autoUpdater } = electronUpdater;

const RELEASES_URL = "https://github.com/dnlaglr/openmcp/releases/latest";
const CHECK_TIMEOUT_MS = 10_000;


function canInstall() {
  if (process.platform !== "darwin") return true;

  const manifest = JSON.parse(readFileSync(join(app.getAppPath(), "package.json"), "utf-8")) as { openmcp?: { macSigned?: boolean } };
  return manifest.openmcp?.macSigned === true;
}


async function findUpdate() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  try {
    const timeout = new Promise<null>((resolve) => setTimeout(resolve, CHECK_TIMEOUT_MS, null));
    const result = await Promise.race([autoUpdater.checkForUpdates(), timeout]);
    return result?.isUpdateAvailable ? result.updateInfo.version : null;
  } catch (error) {
    console.error("Skipped the launch update check", error);
    return null;
  }
}


function openUpdateWindow(version: string) {
  const window = createWindow(
    "updater",
    { width: 320, height: 400, frame: false, resizable: false, maximizable: false, fullscreenable: false },
    { version }
  );

  window.once("ready-to-show", () => window.show());
  return window;
}


function waitForChoice(window: BrowserWindow) {
  return new Promise<unknown>((resolve) => {
    ipcMain.once("updater:choice", (_event, choice: unknown) => resolve(choice));
    window.once("closed", () => resolve("continue"));
  }).finally(() => ipcMain.removeAllListeners("updater:choice"));
}


export async function updateOnLaunch() {
  if (!app.isPackaged) return;

  const version = await findUpdate();
  if (!version) return;

  const window = openUpdateWindow(version);
  const send = (status: UpdateStatus) => {
    if (!window.isDestroyed()) window.webContents.send("updater:status", status);
  };

  try {
    if (await waitForChoice(window) !== "update") return;

    if (!canInstall()) {
      await shell.openExternal(RELEASES_URL);
      return;
    }

    autoUpdater.on("download-progress", ({ percent }) => send({ state: "downloading", percent }));
    await autoUpdater.downloadUpdate();

    send({ state: "installing" });
    autoUpdater.quitAndInstall(true, true);
    await new Promise<never>(() => {});
  } catch (error) {
    console.error("Skipped the launch update", error);
  } finally {
    if (!window.isDestroyed()) window.close();
  }
}
