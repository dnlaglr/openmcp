import { Button, type ButtonProps } from "./Button";
import { Tooltip } from "./Tooltip";

type IconButtonProps = Omit<ButtonProps, "variant" | "size"> & { label: string };

export function IconButton({ label, ...props }: IconButtonProps) {
  return (
    <Tooltip label={label}>
      <Button variant="ghost" size="icon" aria-label={label} {...props} />
    </Tooltip>
  );
}
