import { BrowserWindow, ipcMain } from "electron";

import { ipc, type IpcChannel, type IpcEvent, type IpcEventPayload, type IpcHandlerInput, type IpcOutput } from "@openmcp/contracts";

import { isAppUrl } from "./windows";

type Handler<C extends IpcChannel> = (input: IpcHandlerInput<C>) => IpcOutput<C> | Promise<IpcOutput<C>>;


export function handle<C extends IpcChannel>(channel: C, handler: Handler<C>) {
  ipcMain.handle(channel, (event, input: unknown) => {
    if (!isAppUrl(event.senderFrame?.url ?? "")) throw new Error(`Rejected ${channel} from an unknown sender.`);
    return handler(ipc[channel].input.parse(input) as IpcHandlerInput<C>);
  });
}


export function emit<E extends IpcEvent>(event: E, ...payload: IpcEventPayload<E> extends void ? [] : [IpcEventPayload<E>]) {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(event, ...payload);
}
