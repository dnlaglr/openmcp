import { Activity, LayoutGrid, Monitor, Server, Settings, type LucideIcon } from "lucide-react";

export type Page = "servers" | "agents" | "activity" | "catalog" | "settings";
export type NavigateParams = { serverId?: string; tab?: "logs" };
export type Navigate = (page: Page, params?: NavigateParams) => void;
export type PageProps = { navigate: Navigate; params: NavigateParams };

export type NavItem = { page: Page; label: string; icon: LucideIcon };

export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Manage",
    items: [
      { page: "servers", label: "Servers", icon: Server },
      { page: "agents", label: "Agents", icon: Monitor },
      { page: "activity", label: "Activity", icon: Activity }
    ]
  },
  { label: "Discover", items: [{ page: "catalog", label: "Catalog", icon: LayoutGrid }] }
];

export const settingsItem: NavItem = { page: "settings", label: "Settings", icon: Settings };
