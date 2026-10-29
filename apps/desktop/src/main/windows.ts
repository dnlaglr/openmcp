import { app, BrowserWindow, shell, type BrowserWindowConstructorOptions } from "electron";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const RENDERER_DIR = join(__dirname, "../renderer");

type Page = "index" | "updater";

function devServerUrl() {
  return app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
}

export function createWindow(page: Page, options: BrowserWindowConstructorOptions, query: Record<string, string> = {}) {
  const window = new BrowserWindow({
    ...options,
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.removeMenu();
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event) => event.preventDefault());

  void loadPage(window, page, query);
  return window;
}

export function createMainWindow() {
  return createWindow("index", { width: 1200, height: 800, minWidth: 900, minHeight: 600, title: "OpenMCP" });
}

export function isAppUrl(url: string) {
  const devUrl = devServerUrl();
  if (devUrl) return URL.parse(url)?.origin === new URL(devUrl).origin;

  return url.startsWith(`${pathToFileURL(RENDERER_DIR).href}/`);
}

function loadPage(window: BrowserWindow, page: Page, query: Record<string, string>) {
  const devUrl = devServerUrl();
  if (!devUrl) return window.loadFile(join(RENDERER_DIR, `${page}.html`), { query });

  const url = new URL(`${page}.html`, `${devUrl}/`);
  url.search = new URLSearchParams(query).toString();

  return window.loadURL(url.href);
}
