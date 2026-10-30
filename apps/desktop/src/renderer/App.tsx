import { useState, type ComponentType } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ActivityPage } from "@/features/activity/ActivityPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { CatalogPage } from "@/features/catalog/CatalogPage";
import { ClientsPage } from "@/features/clients/ClientsPage";
import { ServersPage } from "@/features/servers/ServersPage";
import type { Page, PageProps } from "@/lib/navigation";
import { AppSidebar } from "@/components/AppSidebar";

const pages: Record<Page, ComponentType<PageProps>> = {
  servers: ServersPage,
  clients: ClientsPage,
  activity: ActivityPage,
  catalog: CatalogPage,
  settings: SettingsPage
};

export function App() {
  const [page, setPage] = useState<Page>("servers");
  const Current = pages[page];

  return (
    <SidebarProvider>
      <AppSidebar current={page} onSelect={setPage} />
      <SidebarInset className="min-w-0 p-6">
        <Current navigate={setPage} />
      </SidebarInset>
    </SidebarProvider>
  );
}
