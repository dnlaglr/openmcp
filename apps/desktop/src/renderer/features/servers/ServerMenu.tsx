import { Ellipsis } from "lucide-react";

import type { AvailableUpdate, InstalledServer, ServerState } from "@openmcp/contracts";

import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/Menu";
import type { ServerAction } from "./useServers";
import { Tooltip } from "@/components/Tooltip";
import { Button } from "@/components/Button";
import { isActive } from "./serverStatus";

type ServerMenuProps = {
  server: InstalledServer;
  state: ServerState;
  update?: AvailableUpdate;
  signedIn: boolean;
  onAction: (action: ServerAction) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onLogs: () => void;
  onEdit: () => void;
  onUpdate: () => void;
  onRemove: () => void;
};

export function ServerMenu(props: ServerMenuProps) {
  const { server, state, update, signedIn, onAction, onSignIn, onSignOut, onLogs, onEdit, onUpdate, onRemove } = props;

  return (
    <Menu>
      <Tooltip label={`More actions for ${server.name}`}>
        <MenuTrigger render={<Button variant="ghost" size="icon" aria-label={`More actions for ${server.name}`} />}>
          <Ellipsis />
        </MenuTrigger>
      </Tooltip>
      <MenuContent>
        {state.status === "running" && <MenuItem onClick={() => onAction("restart")}>Restart</MenuItem>}
        {isActive(state) && <MenuItem onClick={() => onAction("stop")}>Stop</MenuItem>}
        {(state.status === "stopped" || state.status === "error") && (
          <MenuItem onClick={() => onAction("start")}>Start</MenuItem>
        )}
        {state.status === "signin" && <MenuItem onClick={onSignIn}>Sign in</MenuItem>}
        <MenuSeparator />
        <MenuItem onClick={onLogs}>View logs</MenuItem>
        <MenuItem onClick={onEdit}>Edit…</MenuItem>
        {update && <MenuItem onClick={onUpdate}>Update to v{update.entry.version}…</MenuItem>}
        {signedIn && <MenuItem onClick={onSignOut}>Sign out</MenuItem>}
        <MenuSeparator />
        <MenuItem danger onClick={onRemove}>
          Remove…
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
