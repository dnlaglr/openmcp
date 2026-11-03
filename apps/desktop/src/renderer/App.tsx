import {
  addTransitionType,
  startTransition,
  useCallback,
  useEffect,
  useState,
  ViewTransition,
  type ComponentType
} from "react";

import type { Navigate, NavigateParams, Page, PageProps } from "@/lib/navigation";
import { ActivityPage } from "@/features/activity/ActivityPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { CatalogPage } from "@/features/catalog/CatalogPage";
import { ServersPage } from "@/features/servers/ServersPage";
import { AgentsPage } from "@/features/agents/AgentsPage";
import { StatusBar } from "@/components/StatusBar";
import { Sidebar } from "@/components/Sidebar";
import { Logo } from "@/components/Logo";

const pages: Record<Page, ComponentType<PageProps>> = {
  servers: ServersPage,
  agents: AgentsPage,
  activity: ActivityPage,
  catalog: CatalogPage,
  settings: SettingsPage
};

type Route = { page: Page; params: NavigateParams };

export function App() {
  const [route, setRoute] = useState<Route>({ page: "servers", params: {} });

  const navigate = useCallback<Navigate>(
    (page, params = {}) =>
      startTransition(() => {
        addTransitionType("nav");
        setRoute({ page, params });
      }),
    []
  );
  useEffect(() => window.api.on("app:navigate", ({ page, serverId }) => navigate(page, { serverId })), [navigate]);
  const Current = pages[route.page];

  return (
    <div className="grid h-screen grid-cols-[var(--sidebar-width)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_var(--statusbar-height)] overflow-hidden">
      <Sidebar current={route.page} onSelect={(page) => navigate(page)} />
      <ViewTransition update={{ nav: "page-nav", default: "none" }}>
        <main className="flex min-h-0 min-w-0 flex-col">
          <Current key={route.page} navigate={navigate} params={route.params} />
        </main>
      </ViewTransition>
      <StatusBar navigate={navigate} />
      <div
        role="status"
        className="fixed inset-0 z-100 hidden flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-md in-data-restarting:flex in-data-restarting:animate-[fade_var(--d3)_var(--ease-out)]"
      >
        <span className="bevel-primary mb-2 grid size-14 animate-pulse place-items-center rounded-2xl">
          <Logo className="size-7" />
        </span>
        <b className="font-semibold">Restarting to update…</b>
        <span className="text-xs text-muted-foreground">Your servers come back on their own.</span>
      </div>
    </div>
  );
}
