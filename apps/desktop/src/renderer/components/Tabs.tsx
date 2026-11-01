import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type { ReactNode } from "react";

export const Tabs = TabsPrimitive.Root;
export const TabsPanel = TabsPrimitive.Panel;

export function TabsList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <TabsPrimitive.List aria-label={label} className="seg grid w-full">
      <TabsPrimitive.Indicator className="seg-thumb left-(--active-tab-left) w-(--active-tab-width)" />
      {children}
    </TabsPrimitive.List>
  );
}

export function Tab(props: TabsPrimitive.Tab.Props) {
  return <TabsPrimitive.Tab className="seg-item" {...props} />;
}
