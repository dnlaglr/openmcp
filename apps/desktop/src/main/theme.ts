import type { BrowserWindowConstructorOptions } from "electron";

export const TOOLBAR_HEIGHT = 52;

const colors = {
  light: { background: "#ffffff", symbols: "#5b6478" },
  dark: { background: "#0b1018", symbols: "#aab2c4" }
};

export const windowColors = (dark: boolean) => colors[dark ? "dark" : "light"];

export function frameOptions(platform: NodeJS.Platform, dark: boolean): BrowserWindowConstructorOptions {
  const { background, symbols } = windowColors(dark);
  if (platform === "darwin") {
    return { titleBarStyle: "hidden", trafficLightPosition: { x: 16, y: 18 }, backgroundColor: background };
  }

  return {
    titleBarStyle: "hidden",
    titleBarOverlay: { color: background, symbolColor: symbols, height: TOOLBAR_HEIGHT },
    backgroundColor: background
  };
}
