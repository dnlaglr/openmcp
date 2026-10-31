import { Play, RotateCw, Square, type LucideIcon } from "lucide-react";

import type { InstalledServer, ServerState } from "@openmcp/contracts";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useServerAction, type ServerAction } from "./useServers";
import { Button } from "@/components/ui/button";
import { SignInButton } from "./ServerSignIn";

const controls: Record<ServerAction, { label: string; Icon: LucideIcon }> = {
  start: { label: "Start", Icon: Play },
  stop: { label: "Stop", Icon: Square },
  restart: { label: "Restart", Icon: RotateCw }
};

export function ServerControls({ server, state }: { server: InstalledServer; state: ServerState }) {
  const serverAction = useServerAction();
  if (state.status === "signin") return <SignInButton server={server} />;

  const active = state.status === "starting" || state.status === "running";
  const actions: ServerAction[] = active ? ["stop", "restart"] : ["start"];

  return (
    <div className="flex items-center">
      {actions.map((action) => {
        const { label, Icon } = controls[action];

        return (
          <Tooltip key={action}>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${label} ${server.name}`}
                  disabled={serverAction.isPending}
                  onClick={() => serverAction.mutate({ action, id: server.id })}
                />
              }
            >
              <Icon />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
