import { AlertDialog as AlertPrimitive } from "@base-ui/react/alert-dialog";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ReactNode } from "react";

import { Button } from "./Button";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed?: () => void;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  shake?: number;
  width?: number;
  children: ReactNode;
};

export function Sheet({
  open,
  onOpenChange,
  onClosed,
  title,
  description,
  aside,
  shake = 0,
  width,
  children
}: SheetProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(next) => !next && onClosed?.()}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="scrim" />
        <DialogPrimitive.Popup
          className="sheet"
          style={width ? { width } : undefined}
          data-shake={shake ? shake % 2 : undefined}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[15px] leading-5 font-semibold">{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-0.5 text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            {aside}
          </div>
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function SheetFooter({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-2 pt-0.5">{children}</div>;
}

type AlertSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed?: () => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  error?: string | null;
};

export function AlertSheet({
  open,
  onOpenChange,
  onClosed,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending = false,
  error
}: AlertSheetProps) {
  return (
    <AlertPrimitive.Root open={open} onOpenChange={onOpenChange} onOpenChangeComplete={(next) => !next && onClosed?.()}>
      <AlertPrimitive.Portal>
        <AlertPrimitive.Backdrop className="scrim" />
        <AlertPrimitive.Popup className="sheet">
          <div className="flex gap-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-destructive/12 text-base font-bold text-destructive">
              !
            </span>
            <div>
              <AlertPrimitive.Title className="text-[15px] leading-5 font-semibold">{title}</AlertPrimitive.Title>
              <AlertPrimitive.Description className="mt-0.5 text-muted-foreground">
                {description}
              </AlertPrimitive.Description>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <SheetFooter>
            <AlertPrimitive.Close render={<Button />}>Cancel</AlertPrimitive.Close>
            <Button variant="danger" busy={pending} disabled={pending} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </SheetFooter>
        </AlertPrimitive.Popup>
      </AlertPrimitive.Portal>
    </AlertPrimitive.Root>
  );
}
