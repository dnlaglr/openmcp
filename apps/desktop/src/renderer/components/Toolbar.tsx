import type { ReactNode } from "react";

type ToolbarProps = { title: string; subtitle?: ReactNode; children?: ReactNode };

export function Toolbar({ title, subtitle, children }: ToolbarProps) {
  return (
    <header className="drag relative z-60 flex h-(--toolbar-height) shrink-0 items-center gap-2.5 border-b bg-background pl-5">
      <div className="flex min-w-0 flex-col">
        <h1 className="text-[15px] leading-5 font-semibold">{title}</h1>
        {subtitle && (
          <p className="flex items-center gap-1.5 truncate text-[11px] leading-[14px] text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      <div className="no-drag mr-[calc(100vw-env(titlebar-area-x,0px)-env(titlebar-area-width,100vw))] ml-auto flex items-center gap-2 pr-3">
        {children}
      </div>
    </header>
  );
}
