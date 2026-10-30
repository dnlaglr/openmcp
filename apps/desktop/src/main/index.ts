import { app, autoUpdater, session, type BrowserWindow } from "electron";

import { getServer, listServers, pruneActivity } from "@openmcp/database";

import { registerActivityHandlers } from "./activity/handlers";
import { registerGatewayHandlers } from "./gateway/handlers";
import { registerCatalogHandlers } from "./catalog/handlers";
import { registerClientHandlers } from "./clients/handlers";
import { registerServerHandlers } from "./servers/handlers";
import { createSupervisor } from "./servers/supervisor";
import { createGatewayServer } from "./gateway/server";
import { stdioConnector } from "./servers/connection";
import { createCatalog } from "./gateway/catalog";
import { createGateway } from "./gateway/gateway";
import { launchFor } from "./servers/servers";
import { createMainWindow } from "./windows";
import { updateOnLaunch } from "./updater";
import { openDatabase } from "./database";
import { emit, handle } from "./ipc";
import { createTray } from "./tray";

const ALLOWED_PERMISSIONS = new Set(["clipboard-sanitized-write"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_RETENTION_MS = 30 * DAY_MS;

let mainWindow: BrowserWindow | null = null;
let launched = false;
let quitting = false;

function getMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    const window = createMainWindow();
    window.on("close", (event) => {
      if (quitting) return;

      event.preventDefault();
      window.hide();
    });
    mainWindow = window;
  }

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

  autoUpdater.on("before-quit-for-update", () => {
    quitting = true;
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
      onState: (state) => {
        emit("servers:state", state);
        void catalog.sync(state);
      },
      onLog: (line) => emit("servers:log", line)
    });
    const catalog = createCatalog({
      supervisor,
      nameOf: (id) => getServer(db, id)?.name,
      onChange: (kinds) => gateway.notify(kinds)
    });
    const gateway = createGateway({
      db,
      factory: createGatewayServer({
        catalog,
        supervisor,
        record: (row) => activity.record(row),
        version: app.getVersion()
      }),
      onState: (state) => {
        emit("gateway:state", state);
        if (state.status === "running") void clients.sync();
      }
    });

    const pruneOldActivity = () => pruneActivity(db, new Date(Date.now() - ACTIVITY_RETENTION_MS));
    pruneOldActivity();
    setInterval(pruneOldActivity, DAY_MS);

    let shuttingDown = false;
    app.on("before-quit", (event) => {
      quitting = true;
      if (shuttingDown) return;

      shuttingDown = true;
      event.preventDefault();
      void gateway
        .close()
        .catch((error: unknown) => console.error("Couldn't close the gateway", error))
        .then(() => supervisor.stopAll())
        .finally(() => app.quit());
    });

    handle("app:version", () => app.getVersion());
    const activity = registerActivityHandlers(db);
    registerServerHandlers(db, supervisor);
    registerCatalogHandlers(db, supervisor);
    registerGatewayHandlers(gateway);
    const clients = registerClientHandlers(gateway);
    void gateway.start();

    getMainWindow();
    createTray({ show: showMainWindow, quit: () => app.quit() });

    await updateOnLaunch();
    launched = true;
    showMainWindow();

    const autostart = listServers(db).filter((server) => server.autostart);
    for (const server of autostart) void supervisor.start(server.id);
  });
}
