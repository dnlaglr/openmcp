import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type DisclosureProps = { title: ReactNode; children: ReactNode; defaultOpen?: boolean };

export function Disclosure({ title, children, defaultOpen = false }: DisclosureProps) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen}>
      <Collapsible.Trigger className="group flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground outline-none focus-visible:focus-halo">
        <ChevronRight className="size-3 transition-transform duration-(--d3) ease-(--ease-move) group-data-panel-open:rotate-90" />
        {title}
      </Collapsible.Trigger>
      <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-(--d3) ease-(--ease-move) data-ending-style:h-0 data-starting-style:h-0">
        <div className="flex flex-col gap-1.5 pt-2">{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
