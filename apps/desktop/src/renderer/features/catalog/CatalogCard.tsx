import { Check } from "lucide-react";

import type { CatalogEntry, InstalledServer } from "@openmcp/contracts";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type CatalogCardProps = {
  entry: CatalogEntry;
  installed: InstalledServer | undefined;
  onInstall: () => void;
  onOpenServers: () => void;
};

export function CatalogCard({ entry, installed, onInstall, onOpenServers }: CatalogCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="min-w-0 truncate">{entry.title}</CardTitle>
        <CardDescription className="min-w-0 truncate font-mono text-xs">{entry.name}</CardDescription>
        <CardAction>
          <Badge variant="secondary">{entry.runner}</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex-1">
        <p className="line-clamp-2 text-muted-foreground">{entry.description}</p>
      </CardContent>

      <CardFooter className="flex-wrap justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {entry.deprecated !== null && <Badge variant="destructive">Deprecated</Badge>}
          {installed && installed.version !== entry.version && <Badge variant="outline">Update available</Badge>}
        </div>

        {installed ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="size-3.5" /> Installed
            </span>
            <Button variant="outline" size="sm" onClick={onOpenServers}>
              Open in Servers
            </Button>
          </div>
        ) : (
          <Button size="sm" aria-label={`Install ${entry.title}`} onClick={onInstall}>
            Install
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
