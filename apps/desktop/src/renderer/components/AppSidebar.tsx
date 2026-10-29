import { Fragment } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator
} from "@/components/ui/sidebar";
import { footerTabs, tabGroups, type NavItem, type Page } from "@/lib/navigation";
import { GatewayStatus } from "@/components/GatewayStatus";
import { Logo } from "@/components/Logo";

type NavProps = { current: Page; onSelect: (page: Page) => void };

function NavMenu({ items, current, onSelect }: NavProps & { items: NavItem[] }) {
  return (
    <SidebarMenu>
      {items.map(({ page, label, icon: Icon }) => (
        <SidebarMenuItem key={page}>
          <SidebarMenuButton isActive={page === current} tooltip={label} onClick={() => onSelect(page)}>
            <Icon />
            <span>{label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function AppSidebar(props: NavProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-8 items-center gap-2 px-2 font-semibold">
          <Logo className="size-4 shrink-0 text-primary" />
          <span className="truncate group-data-[collapsible=icon]:hidden">OpenMCP</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {tabGroups.map((items, index) => (
          <Fragment key={items[0].page}>
            {index > 0 && <SidebarSeparator />}
            <SidebarGroup>
              <NavMenu items={items} {...props} />
            </SidebarGroup>
          </Fragment>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <GatewayStatus />
        <NavMenu items={footerTabs} {...props} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
