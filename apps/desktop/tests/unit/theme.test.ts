import { expect, test } from "vitest";

import { frameOptions, TOOLBAR_HEIGHT, windowColors } from "../../src/main/theme";

test("hides the title bar and keeps the caption buttons on Windows", () => {
  expect(frameOptions("win32", false)).toEqual({
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#ffffff", symbolColor: "#5b6478", height: TOOLBAR_HEIGHT },
    backgroundColor: "#ffffff"
  });
});

test("paints the overlay and background dark in dark mode", () => {
  expect(frameOptions("linux", true)).toMatchObject({
    titleBarOverlay: { color: "#0b1018", symbolColor: "#aab2c4" },
    backgroundColor: windowColors(true).background
  });
});

test("moves the traffic lights onto the toolbar on macOS", () => {
  expect(frameOptions("darwin", false)).toEqual({
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: "#ffffff"
  });
});
