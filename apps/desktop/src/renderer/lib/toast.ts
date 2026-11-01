import { Toast } from "@base-ui/react/toast";

export const toaster = Toast.createToastManager();

export function toast(title: string, action?: { label: string; onClick: () => void }) {
  toaster.add({
    title,
    timeout: 3400,
    actionProps: action && { children: action.label, onClick: action.onClick }
  });
}
