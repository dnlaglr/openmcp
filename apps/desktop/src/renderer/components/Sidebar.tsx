import { Fragment } from "react";

import { navGroups, settingsItem, type NavItem, type Page } from "@/lib/navigation";
import { useAgentCounts } from "@/features/agents/useClients";
import { useServers } from "@/features/servers/useServers";
import { Logo } from "./Logo";

type SidebarProps = { current: Page; onSelect: (page: Page) => void };

export function Sidebar({ current, onSelect }: SidebarProps) {
  const { data: servers } = useServers();
  const agents = useAgentCounts();
  const agentsCount = agents.active ? `${agents.active} active` : `${agents.connected} of ${agents.installed}`;
  const counts: Partial<Record<Page, string>> = {
    servers: servers && String(servers.length),
    agents: agents.installed > 0 ? agentsCount : undefined
  };

  const item = ({ page, label, icon: Icon }: NavItem) => (
    <button
      key={page}
      type="button"
      aria-current={page === current ? "page" : undefined}
      onClick={() => onSelect(page)}
      className="group no-drag flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] outline-none transition-colors duration-(--d1) hover:bg-tint-2 focus-visible:focus-halo aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
    >
      <Icon className="size-4 text-primary group-aria-[current=page]:text-current" />
      {label}
      {counts[page] && (
        <span aria-hidden className="ml-auto text-[11px] text-muted-foreground group-aria-[current=page]:text-white/80">
          {counts[page]}
        </span>
      )}
    </button>
  );

  return (
    <aside className="drag flex min-h-0 flex-col gap-0.5 border-r bg-sidebar px-2.5 pt-3.5 pb-2.5 in-data-[platform=mac]:pt-10">
      <div className="mb-1.5 flex h-6 items-center gap-2 px-2 font-semibold">
        <Logo className="size-4 text-primary" />
        OpenMCP
      </div>
      {navGroups.map((group) => (
        <Fragment key={group.label}>
          <p className="px-2 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground">{group.label}</p>
          {group.items.map(item)}
        </Fragment>
      ))}
      <div className="mt-auto">{item(settingsItem)}</div>
    </aside>
  );
}
