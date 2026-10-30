import { useState, type ComponentType } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ActivityPage } from "@/features/activity/ActivityPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { CatalogPage } from "@/features/catalog/CatalogPage";
import { ClientsPage } from "@/features/clients/ClientsPage";
import { ServersPage } from "@/features/servers/ServersPage";
import { AppSidebar } from "@/components/AppSidebar";
import type { Page } from "@/lib/navigation";

const pages = {
  servers: ServersPage,
  clients: ClientsPage,
  activity: ActivityPage,
  catalog: CatalogPage,
  settings: SettingsPage
} satisfies Record<Page, ComponentType>;

export function App() {
  const [page, setPage] = useState<Page>("servers");
  const Current = pages[page];

  return (
    <SidebarProvider>
      <AppSidebar current={page} onSelect={setPage} />
      <SidebarInset className="min-w-0 p-6">
        <Current />
      </SidebarInset>
    </SidebarProvider>
  );
}
