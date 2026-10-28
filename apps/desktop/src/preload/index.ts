import { contextBridge, ipcRenderer } from "electron";

import type { Api, UpdaterApi, UpdateStatus } from "@openmcp/contracts";

const api: Api = { invoke: (channel, ...input) => ipcRenderer.invoke(channel, ...input) };

const updater: UpdaterApi = {
  choose: (choice) => ipcRenderer.send("updater:choice", choice),
  onStatus: (callback) => ipcRenderer.on("updater:status", (_event, status: UpdateStatus) => callback(status))
};

contextBridge.exposeInMainWorld("api", api);
contextBridge.exposeInMainWorld("updater", updater);
