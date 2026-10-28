import { app, session, type BrowserWindow } from "electron";

import { registerHandlers } from "./handlers";
import { createMainWindow } from "./windows";
import { updateOnLaunch } from "./updater";

const ALLOWED_PERMISSIONS = new Set(["clipboard-sanitized-write"]);

let mainWindow: BrowserWindow | null = null;
let launched = false;


function getMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createMainWindow();
  return mainWindow;
}


function showMainWindow() {
  if (!launched) return;

  const window = getMainWindow();
  if (window.isMinimized()) window.restore();

  window.show();
  window.focus();
}


if (!app.isPackaged) app.setPath("userData", `${app.getPath("userData")}-dev`);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showMainWindow);
  app.on("activate", showMainWindow);
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  void app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)));
    registerHandlers();
    getMainWindow();

    await updateOnLaunch();
    launched = true;
    showMainWindow();
  });
}
