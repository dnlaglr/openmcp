import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { ReactNode } from "react";

export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;

export function MenuContent({ children, align = "end" }: { children: ReactNode; align?: "start" | "end" }) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner sideOffset={4} align={align} className="z-70">
        <MenuPrimitive.Popup className="menu-popup">{children}</MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

type MenuItemProps = MenuPrimitive.Item.Props & { hint?: string; danger?: boolean };

export function MenuItem({ hint, danger = false, children, ...props }: MenuItemProps) {
  return (
    <MenuPrimitive.Item className="menu-item" data-danger={danger || undefined} {...props}>
      <span>{children}</span>
      {hint && <span className="menu-hint">{hint}</span>}
    </MenuPrimitive.Item>
  );
}

export function MenuSeparator() {
  return <MenuPrimitive.Separator className="menu-separator" />;
}
