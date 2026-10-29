import { app, session, type BrowserWindow } from "electron";

import { listServers } from "@openmcp/database";

import { registerServerHandlers } from "./servers/handlers";
import { createSupervisor } from "./servers/supervisor";
import { stdioConnector } from "./servers/connection";
import { launchFor } from "./servers/servers";
import { createMainWindow } from "./windows";
import { updateOnLaunch } from "./updater";
import { openDatabase } from "./database";
import { emit, handle } from "./ipc";

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
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) =>
      callback(ALLOWED_PERMISSIONS.has(permission))
    );

    const db = openDatabase();
    app.on("will-quit", () => db.$client.close());

    const supervisor = createSupervisor({
      connect: stdioConnector(app.getVersion()),
      resolve: (id) => launchFor(db, id),
      onState: (state) => emit("servers:state", state),
      onLog: (line) => emit("servers:log", line)
    });

    let quitting = false;
    app.on("before-quit", (event) => {
      if (quitting) return;

      quitting = true;
      event.preventDefault();
      void supervisor.stopAll().finally(() => app.quit());
    });

    handle("app:version", () => app.getVersion());
    registerServerHandlers(db, supervisor);
    getMainWindow();

    await updateOnLaunch();
    launched = true;
    showMainWindow();

    const autostart = listServers(db).filter((server) => server.autostart);
    for (const server of autostart) void supervisor.start(server.id);
  });
}
