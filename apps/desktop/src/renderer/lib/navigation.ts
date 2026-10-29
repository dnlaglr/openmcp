import { Activity, Monitor, Server, Settings, Store, type LucideIcon } from "lucide-react";

export type Page = "servers" | "clients" | "activity" | "catalog" | "settings";

export type NavItem = { page: Page; label: string; icon: LucideIcon };

export const tabGroups: NavItem[][] = [
  [
    { page: "servers", label: "Servers", icon: Server },
    { page: "clients", label: "Clients", icon: Monitor },
    { page: "activity", label: "Activity", icon: Activity },
  ],
  [
    { page: "catalog", label: "Catalog", icon: Store }
  ]
];

export const footerTabs: NavItem[] = [
  { page: "settings", label: "Settings", icon: Settings }
];
