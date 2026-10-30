import type { Gateway } from "./gateway";
import { handle } from "../ipc";

export function registerGatewayHandlers(gateway: Gateway) {
  handle("gateway:state", () => gateway.state());
  handle("gateway:connection", () => gateway.connection());
  handle("gateway:setPort", ({ port }) => gateway.setPort(port));
  handle("gateway:regenerateToken", () => gateway.regenerateToken());
}
