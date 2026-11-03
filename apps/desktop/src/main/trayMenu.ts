import type { MenuItemConstructorOptions } from "electron";

import type { GatewayState, ServerStatus } from "@openmcp/contracts";

export type TrayServer = { id: string; name: string; status: ServerStatus };
export type TrayModel = { gateway: GatewayState; servers: TrayServer[] };
export type TrayActions = {
  show: () => void;
  quit: () => void;
  copyUrl: () => void;
  open: (id: string) => void;
  act: (id: string, action: "start" | "stop" | "restart") => void;
  signIn: (id: string) => void;
};
export type Dot = "running" | "attention" | "error" | "stopped";
export type TrayVariant = "normal" | "attention" | "dimmed";

type Icon = MenuItemConstructorOptions["icon"];

const labels: Record<ServerStatus, string> = {
  running: "Running",
  starting: "Starting",
  signin: "Needs sign-in",
  stopped: "Stopped",
  error: "Error"
};

const dotOf: Record<ServerStatus, Dot> = {
  running: "running",
  starting: "attention",
  signin: "attention",
  stopped: "stopped",
  error: "error"
};

const needsYou = (server: TrayServer) => server.status === "signin" || server.status === "error";

export function trayVariant({ gateway, servers }: TrayModel): TrayVariant {
  if (gateway.status !== "running") return "dimmed";
  return servers.some(needsYou) ? "attention" : "normal";
}

export function trayTooltip({ gateway, servers }: TrayModel) {
  if (gateway.status === "error") return "OpenMCP · Gateway stopped";

  const waiting = servers.filter(needsYou);
  if (waiting.length > 1) return `OpenMCP · ${waiting.length} servers need you`;
  if (waiting.length === 1)
    return `OpenMCP · ${waiting[0].name} ${waiting[0].status === "signin" ? "needs sign-in" : "couldn’t start"}`;
  return "OpenMCP";
}

function gatewayItem({ status, port }: GatewayState, dots: Record<Dot, Icon>): MenuItemConstructorOptions {
  if (status === "running") return { label: `Gateway running on :${port}`, enabled: false, icon: dots.running };
  if (status === "error") return { label: "Gateway stopped", enabled: false, icon: dots.error };
  return { label: "Starting gateway", enabled: false, icon: dots.attention };
}

function serverItems(server: TrayServer, actions: TrayActions): MenuItemConstructorOptions[] {
  const run = (action: "start" | "stop" | "restart") => () => actions.act(server.id, action);
  const show = { label: "Show in OpenMCP", click: () => actions.open(server.id) };

  if (server.status === "running")
    return [
      { label: "Restart", click: run("restart") },
      { label: "Stop", click: run("stop") },
      { type: "separator" },
      show
    ];
  if (server.status === "starting") return [{ label: "Stop", click: run("stop") }, { type: "separator" }, show];
  if (server.status === "signin")
    return [{ label: "Sign in…", click: () => actions.signIn(server.id) }, { type: "separator" }, show];
  return [{ label: "Start", click: run("start") }, { type: "separator" }, show];
}

export function trayMenu(
  model: TrayModel,
  actions: TrayActions,
  dots: Record<Dot, Icon>,
  platform: NodeJS.Platform
): MenuItemConstructorOptions[] {
  const rows = model.servers.map((server): MenuItemConstructorOptions => ({
    ...(platform === "darwin"
      ? { label: server.name, sublabel: labels[server.status] }
      : { label: `${server.name}\t${labels[server.status]}` }),
    icon: dots[dotOf[server.status]],
    submenu: serverItems(server, actions)
  }));
  const servers: MenuItemConstructorOptions[] =
    rows.length > 0 ? [{ label: "Servers", enabled: false }, ...rows, { type: "separator" }] : [];

  return [
    gatewayItem(model.gateway, dots),
    { type: "separator" },
    ...servers,
    { label: "Copy gateway URL", enabled: model.gateway.status === "running", click: actions.copyUrl },
    { label: "Open OpenMCP", click: actions.show },
    { type: "separator" },
    { label: "Quit OpenMCP", click: actions.quit }
  ];
}
