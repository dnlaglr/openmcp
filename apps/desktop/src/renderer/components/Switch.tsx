import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "cn";

export function Switch({ size = "md", className, ...props }: SwitchPrimitive.Root.Props & { size?: "sm" | "md" }) {
  return (
    <SwitchPrimitive.Root
      data-size={size}
      className={cn("switch outline-none focus-visible:focus-halo", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="switch-thumb" />
    </SwitchPrimitive.Root>
  );
}
