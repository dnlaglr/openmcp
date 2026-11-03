import { Menu, nativeImage, Tray, type NativeImage } from "electron";

import {
  trayMenu,
  trayTooltip,
  trayVariant,
  type Dot,
  type TrayActions,
  type TrayModel,
  type TrayVariant
} from "./trayMenu";
import { dim, disc, DOT_COLORS, over } from "./trayIcons";
import icon from "../../resources/icon.png?asset";

const SIZE = 32;

const image = (bitmap: Buffer) => nativeImage.createFromBitmap(bitmap, { width: SIZE, height: SIZE, scaleFactor: 2 });

let tray: Tray | undefined;

export function createTray(actions: TrayActions) {
  const base = nativeImage.createFromPath(icon).resize({ width: SIZE, height: SIZE, quality: "best" }).toBitmap();
  const icons: Record<TrayVariant, NativeImage> = {
    normal: image(base),
    attention: image(over(base, disc(SIZE, DOT_COLORS.attention, SIZE * 0.22, [SIZE * 0.78, SIZE * 0.78]))),
    dimmed: image(dim(base))
  };
  const dots = Object.fromEntries(
    Object.entries(DOT_COLORS).map(([dot, color]) => [dot, image(disc(SIZE, color))])
  ) as Record<Dot, NativeImage>;

  tray = new Tray(icons.normal);
  tray.setToolTip("OpenMCP");
  tray.on("click", actions.show);

  return (model: TrayModel) => {
    tray?.setImage(icons[trayVariant(model)]);
    tray?.setToolTip(trayTooltip(model));
    tray?.setContextMenu(Menu.buildFromTemplate(trayMenu(model, actions, dots, process.platform)));
  };
}
