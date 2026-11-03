import { addTransitionType, startTransition, useRef, useState, ViewTransition, type KeyboardEvent } from "react";
import { ChevronDown, Plus } from "lucide-react";

import { launchLabel, type AvailableUpdate, type InstalledServer } from "@openmcp/contracts";

import {
  useRemoveServer,
  useServerAction,
  useServerCounts,
  useServers,
  useServerStates,
  useSignedIn,
  useSignIn,
  useSigningIn,
  useSignOut,
  type ServerAction
} from "./useServers";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/Menu";
import { ServerInspector, type InspectorTab } from "./ServerInspector";
import { useActivitySummary } from "@/features/activity/useActivity";
import { useUpdates } from "@/features/catalog/useCatalog";
import { useFindShortcut } from "@/hooks/useFindShortcut";
import { UpdateServerSheet } from "./UpdateServerSheet";
import { SearchField } from "@/components/SearchField";
import { ErrorState } from "@/components/ErrorState";
import type { PageProps } from "@/lib/navigation";
import { Skeleton } from "@/components/Skeleton";
import { ipcErrorMessage } from "@/lib/ipcError";
import { AlertSheet } from "@/components/Sheet";
import { Toolbar } from "@/components/Toolbar";
import type { Presence } from "@/lib/presence";
import { useLinger } from "@/hooks/useLinger";
import { Button } from "@/components/Button";
import { ServerSheet } from "./ServerSheet";
import { isActive } from "./serverStatus";
import { ServerList } from "./ServerList";
import { ServerMenu } from "./ServerMenu";
import { ServerRow } from "./ServerRow";
import { FirstRun } from "./FirstRun";
import { toast } from "@/lib/toast";

type SheetState =
  | { kind: "add"; remote: boolean; opened: number }
  | { kind: "edit" | "remove"; server: InstalledServer }
  | { kind: "update"; server: InstalledServer; update: AvailableUpdate };

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function AddServerMenu({ onCatalog, onAdd }: { onCatalog: () => void; onAdd: (remote: boolean) => void }) {
  return (
    <Menu>
      <MenuTrigger render={<Button variant="primary" />}>
        <Plus />
        Add server
        <ChevronDown />
      </MenuTrigger>
      <MenuContent>
        <MenuItem hint="Ready-made servers from the MCP Registry" onClick={onCatalog}>
          From the catalog…
        </MenuItem>
        <MenuSeparator />
        <MenuItem hint="Runs a program on this machine" onClick={() => onAdd(false)}>
          Local command…
        </MenuItem>
        <MenuItem hint="Connects to a server over HTTPS" onClick={() => onAdd(true)}>
          Remote URL…
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function ListSkeleton() {
  return (
    <div className="delayed flex flex-col px-5 pt-9">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex h-[52px] items-center gap-2.5">
          <Skeleton className="size-[30px] rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="w-40" />
            <Skeleton className="w-64" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ServersPage({ navigate, params }: PageProps) {
  const servers = useServers();
  const stateOf = useServerStates();
  const countsOf = useServerCounts();
  const updates = useUpdates();
  const { data: signedIn = [] } = useSignedIn();
  const signingIn = useSigningIn();
  const { data: usage } = useActivitySummary({ range: "24h" });
  const action = useServerAction();
  const signIn = useSignIn();
  const signOut = useSignOut();
  const removeServer = useRemoveServer();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(params.serverId ?? null);
  const [lastParams, setLastParams] = useState(params);
  const [tab, setTab] = useState<InspectorTab>(params.tab ?? "overview");
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const filter = useRef<HTMLInputElement>(null);
  useFindShortcut(filter);

  if (params !== lastParams) {
    setLastParams(params);
    if (params.serverId) setSelected(params.serverId);
    if (params.tab) setTab(params.tab);
  }

  const all = servers.data ?? [];
  const current = all.find((server) => server.id === selected) ?? null;
  const inspected = useLinger(current, 320);
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? all.filter((server) => `${server.name}\n${launchLabel(server.launch)}`.toLowerCase().includes(needle))
    : all;
  const setup = servers.isSuccess && (all.length === 0 || settingUp);

  const updateOf = (id: string) => updates.find((update) => update.serverId === id);
  const usageOf = (id: string) => usage?.groups.find((group) => group.serverId === id);

  const running = all.filter((server) => stateOf(server.id).status === "running").length;
  const needYou = all.filter((server) => ["signin", "error"].includes(stateOf(server.id).status)).length;
  const updateCount = all.filter((server) => updateOf(server.id)).length;

  let subtitle: string | undefined = "Loading…";
  if (servers.error) subtitle = undefined;
  else if (servers.isSuccess && all.length === 0) subtitle = "No servers yet";
  else if (servers.isSuccess)
    subtitle = [
      plural(all.length, "server", "servers"),
      `${running} running`,
      needYou > 0 && `${needYou} ${needYou === 1 ? "needs" : "need"} you`,
      updateCount > 0 && plural(updateCount, "update", "updates")
    ]
      .filter(Boolean)
      .join(" · ");

  function select(id: string | null) {
    if (id === current?.id) return;
    if (id && current)
      startTransition(() => {
        addTransitionType("swap");
        setSelected(id);
      });
    else setSelected(id);
  }

  function openSheet(next: SheetState) {
    removeServer.reset();
    setSheet(next);
    setSheetOpen(true);
  }

  const openAdd = (remote: boolean) => openSheet({ kind: "add", remote, opened: Date.now() });

  function handlers(server: InstalledServer) {
    return {
      onAction: (kind: ServerAction) => action.mutate({ action: kind, id: server.id }),
      onSignIn: () => signIn.mutate(server.id),
      onSignOut: () => signOut.mutate(server.id, { onSuccess: () => toast(`Signed out of ${server.name}`) }),
      onEdit: () => openSheet({ kind: "edit", server }),
      onUpdate: () => {
        const update = updateOf(server.id);
        if (update) openSheet({ kind: "update", server, update });
      },
      onRemove: () => openSheet({ kind: "remove", server })
    };
  }

  function added(server: InstalledServer) {
    setSettingUp(false);
    setSelected(server.id);
    if (!server.autostart) action.mutate({ action: "start", id: server.id });
    toast(`Added ${server.name}`);
  }

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && event.currentTarget.contains(event.target as Node)) setSelected(null);
  }

  function renderRow(server: InstalledServer, presence: Presence) {
    const state = stateOf(server.id);
    const update = updateOf(server.id);
    const on = handlers(server);

    return (
      <ServerRow
        server={server}
        state={state}
        counts={countsOf(server.id)}
        usage={usageOf(server.id)}
        update={update}
        selected={server.id === current?.id}
        waiting={signingIn.includes(server.id)}
        presence={presence}
        onSelect={() => select(server.id)}
        onAction={on.onAction}
        onSignIn={on.onSignIn}
        menu={
          <ServerMenu
            server={server}
            state={state}
            update={update}
            signedIn={signedIn.includes(server.id)}
            {...on}
            onLogs={() => {
              select(server.id);
              setTab("logs");
            }}
          />
        }
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={closeOnEscape}>
      <Toolbar title="Servers" subtitle={subtitle}>
        {servers.isSuccess && !setup && (
          <SearchField
            ref={filter}
            className="w-[180px]"
            placeholder="Filter"
            aria-label="Filter servers"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
        <AddServerMenu onCatalog={() => navigate("catalog")} onAdd={openAdd} />
      </Toolbar>

      {servers.isPending && <ListSkeleton />}
      {servers.error && (
        <ErrorState title="Couldn’t load your servers" error={servers.error} onRetry={() => void servers.refetch()} />
      )}
      {setup && (
        <FirstRun
          canFinish={all.length > 0}
          onInstall={() => setSettingUp(true)}
          onDone={() => setSettingUp(false)}
          onAddCustom={() => openAdd(false)}
          onBrowse={() => navigate("catalog")}
        />
      )}
      {servers.isSuccess && !setup && (
        <div
          data-open={current ? "" : undefined}
          className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_0px] transition-[grid-template-columns] duration-(--d4) ease-(--ease-move) data-open:grid-cols-[minmax(0,1fr)_440px]"
        >
          <ServerList
            servers={shown}
            compact={current !== null}
            selected={current?.id ?? null}
            empty={`No servers match “${query.trim()}”.`}
            onSelect={select}
            renderRow={renderRow}
          />
          <div className="min-h-0 min-w-0 overflow-hidden border-l border-transparent transition-colors duration-(--d3) in-data-open:border-border">
            {inspected && (
              <ViewTransition update={{ swap: "inspector-swap", default: "none" }}>
                <ServerInspector
                  server={inspected}
                  state={stateOf(inspected.id)}
                  counts={countsOf(inspected.id)}
                  update={updateOf(inspected.id)}
                  waiting={signingIn.includes(inspected.id)}
                  signedIn={signedIn.includes(inspected.id)}
                  tab={tab}
                  onTab={setTab}
                  onClose={() => setSelected(null)}
                  navigate={navigate}
                  {...handlers(inspected)}
                />
              </ViewTransition>
            )}
          </div>
        </div>
      )}

      {sheet?.kind === "add" && (
        <ServerSheet
          key={`add-${sheet.opened}`}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onClosed={() => setSheet(null)}
          remote={sheet.remote}
          onAdded={added}
        />
      )}
      {sheet?.kind === "edit" && (
        <ServerSheet
          key={`edit-${sheet.server.id}`}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onClosed={() => setSheet(null)}
          server={sheet.server}
          running={isActive(stateOf(sheet.server.id))}
        />
      )}
      {sheet?.kind === "update" && (
        <UpdateServerSheet
          key={`update-${sheet.server.id}`}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onClosed={() => setSheet(null)}
          server={sheet.server}
          update={sheet.update}
          state={stateOf(sheet.server.id)}
        />
      )}
      {sheet?.kind === "remove" && (
        <AlertSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onClosed={() => setSheet(null)}
          title={`Remove “${sheet.server.name}”?`}
          description="This deletes the server and the secrets kept for it in your keychain. Agents lose its tools right away."
          confirmLabel="Remove"
          pending={removeServer.isPending}
          error={removeServer.error && ipcErrorMessage(removeServer.error)}
          onConfirm={() =>
            removeServer.mutate(sheet.server.id, {
              onSuccess: () => {
                setSheetOpen(false);
                toast(`Removed ${sheet.server.name}`);
              }
            })
          }
        />
      )}
    </div>
  );
}
