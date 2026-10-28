import type { Api, UpdaterApi } from "@openmcp/contracts";

declare global {
  interface Window {
    api: Api;
    updater: UpdaterApi;
  }
}
