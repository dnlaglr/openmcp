import { Toast } from "@base-ui/react/toast";
import { Check } from "lucide-react";

export function Toaster() {
  const { toasts } = Toast.useToastManager();

  return (
    <Toast.Portal>
      <Toast.Viewport className="hud-viewport">
        {toasts.map((item) => (
          <Toast.Root key={item.id} toast={item} className="hud">
            <Check className="size-3.5 text-status-running" aria-hidden />
            <Toast.Title />
            {item.actionProps && <Toast.Action className="hud-action" />}
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
