import electronUpdater from "electron-updater";
import { readFileSync } from "node:fs";
import { app, shell } from "electron";
import { join } from "node:path";

import type { UpdateState } from "@openmcp/contracts";

import { highlights } from "./releaseNotes";

const { autoUpdater } = electronUpdater;

const RELEASES_URL = "https://github.com/dnlaglr/openmcp/releases/latest";
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

function canInstall() {
  if (process.platform !== "darwin") return true;

  const manifest = JSON.parse(readFileSync(join(app.getAppPath(), "package.json"), "utf-8")) as {
    openmcp?: { macSigned?: boolean };
  };
  return manifest.openmcp?.macSigned === true;
}

export function createUpdater(onState: (state: UpdateState) => void) {
  let state: UpdateState = { status: "idle", version: null, percent: 0, notes: [], releasedAt: null };

  function set(patch: Partial<UpdateState>) {
    state = { ...state, ...patch };
    onState(state);
  }

  async function check() {
    if (state.status !== "idle") return;

    try {
      const result = await autoUpdater.checkForUpdates();
      if (!result?.isUpdateAvailable) return;

      const { version, releaseNotes, releaseDate } = result.updateInfo;
      const found = {
        version,
        notes: highlights(releaseNotes),
        releasedAt: releaseDate ? new Date(releaseDate) : null
      };
      if (!canInstall()) return set({ ...found, status: "manual" });

      set({ ...found, status: "downloading", percent: 0 });
      await autoUpdater.downloadUpdate();
      set({ status: "ready", percent: 100 });
    } catch (error) {
      console.error("Couldn't check for updates", error);
      set({ status: "idle", percent: 0 });
    }
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on("download-progress", ({ percent }) => set({ percent: Math.round(percent) }));

  return {
    start() {
      if (!app.isPackaged) return;

      void check();
      setInterval(() => void check(), CHECK_EVERY_MS);
    },
    state: () => state,
    install() {
      if (state.status === "ready") autoUpdater.quitAndInstall(true, true);
      else if (state.status === "manual") void shell.openExternal(RELEASES_URL);
    }
  };
}
