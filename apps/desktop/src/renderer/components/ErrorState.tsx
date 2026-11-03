import { ipcErrorMessage } from "@/lib/ipcError";
import { Button } from "./Button";

type ErrorStateProps = { title: string; description?: string; error: unknown; onRetry: () => void };

export function ErrorState({ title, description, error, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-1 animate-up flex-col items-center justify-center gap-2 p-8 text-center">
      <b className="font-semibold">{title}</b>
      {description && <p className="text-muted-foreground">{description}</p>}
      <p className="max-w-[420px] font-mono text-xs text-muted-foreground">{ipcErrorMessage(error)}</p>
      <Button size="sm" className="mt-1" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
