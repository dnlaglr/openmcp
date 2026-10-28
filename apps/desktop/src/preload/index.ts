import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import { ipcEvents, type Api, type UpdaterApi, type UpdateStatus } from "@openmcp/contracts";

const api: Api = {
  invoke: (channel, ...input) => ipcRenderer.invoke(channel, ...input),
  on: (event, callback) => {
    if (!Object.hasOwn(ipcEvents, event)) throw new Error(`Unknown event: ${event}`);

    const listener = (_event: IpcRendererEvent, payload: Parameters<typeof callback>[0]) => callback(payload);
    ipcRenderer.on(event, listener);
    return () => ipcRenderer.removeListener(event, listener);
  }
};

const updater: UpdaterApi = {
  choose: (choice) => ipcRenderer.send("updater:choice", choice),
  onStatus: (callback) => ipcRenderer.on("updater:status", (_event, status: UpdateStatus) => callback(status))
};

contextBridge.exposeInMainWorld("api", api);
contextBridge.exposeInMainWorld("updater", updater);
