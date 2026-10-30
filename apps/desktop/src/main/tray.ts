import { Menu, nativeImage, Tray } from "electron";

import icon from "../../resources/icon.png?asset";

let tray: Tray | undefined;

export function createTray({ show, quit }: { show: () => void; quit: () => void }) {
  tray = new Tray(nativeImage.createFromPath(icon).resize({ width: 16, height: 16, quality: "best" }));
  tray.setToolTip("OpenMCP");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open OpenMCP", click: show },
      { type: "separator" },
      { label: "Quit OpenMCP", click: quit }
    ])
  );
  tray.on("click", show);
}
