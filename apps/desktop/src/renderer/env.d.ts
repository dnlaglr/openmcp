import type { Api } from "@openmcp/contracts";

declare global {
  interface Window {
    api: Api;
  }
}
