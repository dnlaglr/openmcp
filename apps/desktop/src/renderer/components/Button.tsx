import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 font-medium whitespace-nowrap select-none transition-[filter,opacity] duration-(--d1) outline-none focus-visible:focus-halo disabled:opacity-45 active:not-disabled:brightness-94 [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bevel",
        primary: "bevel-primary",
        danger: "bevel-danger",
        ghost: "text-muted-foreground hover:bg-tint-2 hover:text-foreground"
      },
      size: {
        sm: "h-6 rounded-md px-2.5 text-xs",
        md: "h-7 rounded-[7px] px-3 text-[13px]",
        icon: "size-[26px] rounded-md"
      }
    },
    defaultVariants: { variant: "default", size: "md" }
  }
);

export type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { busy?: boolean };

export function Button({ className, variant, size, busy = false, children, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      className={cn(buttonVariants({ variant, size }), className)}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy && <span className="spinner" aria-hidden />}
      {children}
    </ButtonPrimitive>
  );
}
