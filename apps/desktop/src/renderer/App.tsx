import { addTransitionType, startTransition, useCallback, useState, ViewTransition, type ComponentType } from "react";

import type { Navigate, NavigateParams, Page, PageProps } from "@/lib/navigation";
import { ActivityPage } from "@/features/activity/ActivityPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { CatalogPage } from "@/features/catalog/CatalogPage";
import { ServersPage } from "@/features/servers/ServersPage";
import { AgentsPage } from "@/features/agents/AgentsPage";
import { StatusBar } from "@/components/StatusBar";
import { Sidebar } from "@/components/Sidebar";

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
    </div>
  );
}
