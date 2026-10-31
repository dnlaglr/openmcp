import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type { ReactElement } from "react";

type TooltipProps = { label: string; children: ReactElement; side?: "top" | "bottom" | "left" | "right" };

export function Tooltip({ label, children, side = "top" }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={6} className="z-70">
          <TooltipPrimitive.Popup className="tooltip">{label}</TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
