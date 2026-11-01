import type { ReactNode } from "react";

import { Toolbar } from "./Toolbar";

type PageHeaderProps = { title: string; description?: string; actions?: ReactNode };

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Toolbar title={title} subtitle={description}>
      {actions}
    </Toolbar>
  );
}
