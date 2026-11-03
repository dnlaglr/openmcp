import { app, autoUpdater, clipboard, dialog, nativeTheme, session, shell, type BrowserWindow } from "electron";

import { getServer, listServers, pruneActivity } from "@openmcp/database";

import { registerActivityHandlers } from "./activity/handlers";
import { loadAppearance, saveAppearance } from "./appearance";
import { registerGatewayHandlers } from "./gateway/handlers";
import { registerCatalogHandlers } from "./catalog/handlers";
import { registerClientHandlers } from "./clients/handlers";
import { registerServerHandlers } from "./servers/handlers";
import { registerSystemHandlers } from "./system/handlers";
import { createSupervisor } from "./servers/supervisor";
import { createUpdater, RELEASES_URL } from "./updater";
import { createGatewayServer } from "./gateway/server";
import { createCatalog } from "./gateway/catalog";
import { createGateway } from "./gateway/gateway";
import { connector } from "./servers/connection";
import { createSignIn } from "./servers/signIn";
import { launchFor } from "./servers/servers";
import { createMainWindow } from "./windows";
import { emit, handle, onEmit } from "./ipc";
import { openDatabase } from "./database";
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

  const startup = app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) =>
      callback(ALLOWED_PERMISSIONS.has(permission))
    );

    const db = openDatabase();
    app.on("will-quit", () => db.$client.close());
    loadAppearance(db, nativeTheme);
    handle("app:appearance", () => nativeTheme.themeSource);
    handle("app:setAppearance", (appearance) => saveAppearance(db, nativeTheme, appearance));

    const supervisor = createSupervisor({
      connect: connector(app.getVersion()),
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
      onChange: (kinds) => gateway.notify(kinds),
      onCounts: (counts) => emit("servers:counts", counts)
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
    const oauth = createSignIn({
      supervisor,
      urlOf: (id) => {
        const launch = getServer(db, id)?.launch;
        return launch?.type === "http" ? launch.url : undefined;
      },
      // Looked up at call time so Playwright can stand in for the browser.
      openUrl: (url) => shell.openExternal(url),
      onChange: () => emit("servers:changed")
    });
    const servers = registerServerHandlers(db, supervisor, oauth, catalog);
    registerCatalogHandlers(db, supervisor, oauth);
    registerGatewayHandlers(gateway);
    registerSystemHandlers();
    const clients = registerClientHandlers(gateway, db, servers.add);
    void gateway.start();

    getMainWindow();
    const refreshTray = createTray({
      show: showMainWindow,
      quit: () => app.quit(),
      copyUrl: () => clipboard.writeText(gateway.connection().url),
      open: (serverId) => {
        showMainWindow();
        emit("app:navigate", { page: "servers", serverId });
      },
      act: (id, action) => void supervisor[action](id),
      signIn: (id) => {
        showMainWindow();
        void oauth.signIn(id);
      }
    });

    const updateTray = () => {
      const states = new Map(supervisor.states().map((state) => [state.id, state.status]));
      refreshTray({
        gateway: gateway.state(),
        servers: listServers(db).map((server) => ({
          id: server.id,
          name: server.name,
          status: states.get(server.id) ?? "stopped"
        }))
      });
    };

    onEmit((event) => {
      if (event === "servers:changed" || event === "servers:state" || event === "gateway:state") updateTray();
    });
    updateTray();

    const updater = createUpdater((state) => emit("updater:state", state));
    handle("updater:state", () => updater.state());
    handle("updater:install", () => updater.install());

    launched = true;
    showMainWindow();
    updater.start();

    const autostart = listServers(db).filter((server) => server.autostart);
    for (const server of autostart) void supervisor.start(server.id);
  });

  // A windowless instance would keep the single-instance lock, so every relaunch would silently do nothing.
  void startup.catch((error: unknown) => {
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
    dialog.showErrorBox("OpenMCP couldn't start", `${detail}\n\nInstall the latest version from ${RELEASES_URL}`);
    app.exit(1);
  });
}
