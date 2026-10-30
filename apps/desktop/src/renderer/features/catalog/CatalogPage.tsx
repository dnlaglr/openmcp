import { useRef, useState, type ReactNode } from "react";
import { PackageSearch, Search } from "lucide-react";

import { CATALOG_MIN_QUERY, type AvailableUpdate, type CatalogEntry } from "@openmcp/contracts";

import { useCatalogSearch, useDebounced, useInstalledServer, usePopular, useUpdates } from "./useCatalog";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useServers, useServerStates } from "@/features/servers/useServers";
import { InstallServerDialog } from "./InstallServerDialog";
import { UpdateServerDialog } from "./UpdateServerDialog";
import { useVisibility } from "@/hooks/useVisibility";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import type { PageProps } from "@/lib/navigation";
import { ipcErrorMessage } from "@/lib/ipcError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CatalogCard } from "./CatalogCard";

const SEARCH_DELAY_MS = 300;
const gridClass = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";

type GridActions = {
  install: (entry: CatalogEntry) => void;
  update: (update: AvailableUpdate) => void;
  openServers: () => void;
};

function CatalogGrid({ entries, actions }: { entries: CatalogEntry[]; actions: GridActions }) {
  const installedServer = useInstalledServer();
  const updates = useUpdates();

  return (
    <div className={gridClass}>
      {entries.map((entry) => (
        <CatalogCard
          key={entry.name}
          entry={entry}
          installed={installedServer(entry.name)}
          update={updates.find((update) => update.entry.name === entry.name)}
          onInstall={() => actions.install(entry)}
          onUpdate={actions.update}
          onOpenServers={actions.openServers}
        />
      ))}
    </div>
  );
}

function UpdatesSection({ actions }: { actions: GridActions }) {
  const updates = useUpdates();
  if (updates.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Updates</h2>
      <CatalogGrid entries={updates.map((update) => update.entry)} actions={actions} />
    </section>
  );
}

function CardSkeletons() {
  return (
    <div className={gridClass}>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-40 rounded-4xl" />
      ))}
    </div>
  );
}

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <p role="alert" className="text-sm text-destructive">
        {ipcErrorMessage(error)}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function PopularServers({ actions }: { actions: GridActions }) {
  const popular = usePopular();

  let content: ReactNode = <CardSkeletons />;
  if (popular.error) content = <LoadError error={popular.error} onRetry={() => void popular.refetch()} />;
  else if (popular.data) content = <CatalogGrid entries={popular.data} actions={actions} />;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Popular</h2>
      {content}
    </section>
  );
}

function SearchResults({ query, actions }: { query: string; actions: GridActions }) {
  const results = useCatalogSearch(query);
  const end = useRef<HTMLDivElement>(null);

  useVisibility(end, (visible) => {
    if (visible && results.hasNextPage && !results.isFetchingNextPage) void results.fetchNextPage();
  });

  const entries = results.data?.pages.flatMap((page) => page.entries) ?? [];

  let content: ReactNode = <CatalogGrid entries={entries} actions={actions} />;
  if (results.error) content = <LoadError error={results.error} onRetry={() => void results.refetch()} />;
  else if (!results.data) content = <CardSkeletons />;
  else if (entries.length === 0) {
    content = (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageSearch />
          </EmptyMedia>
          <EmptyTitle>No installable servers match “{query}”</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {content}
      {results.isFetchingNextPage && <p className="mt-4 text-center text-xs text-muted-foreground">Loading more…</p>}
      <div ref={end} />
    </>
  );
}

export function CatalogPage({ navigate }: PageProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CatalogEntry>();
  const [installOpen, setInstallOpen] = useState(false);
  const [update, setUpdate] = useState<AvailableUpdate>();
  const [updateOpen, setUpdateOpen] = useState(false);
  const { data: servers = [] } = useServers();
  const stateOf = useServerStates();
  const updating = servers.find((server) => server.id === update?.serverId);
  const typed = search.trim();
  const query = useDebounced(typed, SEARCH_DELAY_MS);

  const actions: GridActions = {
    install: (entry) => {
      setSelected(entry);
      setInstallOpen(true);
    },
    update: (next) => {
      setUpdate(next);
      setUpdateOpen(true);
    },
    openServers: () => navigate("servers")
  };

  let content: ReactNode = <SearchResults query={query} actions={actions} />;
  if (typed.length === 0) {
    content = (
      <div className="flex flex-col gap-8">
        <UpdatesSection actions={actions} />
        <PopularServers actions={actions} />
      </div>
    );
  } else if (typed.length < CATALOG_MIN_QUERY) {
    content = <p className="text-sm text-muted-foreground">Type at least {CATALOG_MIN_QUERY} characters to search.</p>;
  }

  return (
    <>
      <PageHeader title="Catalog" description="Servers from the official MCP Registry." />

      <div className="mb-6 flex flex-col gap-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search servers"
            placeholder="Search servers…"
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">Searches server names</p>
      </div>

      {content}

      {selected && (
        <InstallServerDialog key={selected.name} entry={selected} open={installOpen} onOpenChange={setInstallOpen} />
      )}

      {update && updating && (
        <UpdateServerDialog
          key={`${update.serverId}:${update.entry.version}:${update.inputsChanged}`}
          update={update}
          server={updating}
          state={stateOf(updating.id)}
          open={updateOpen}
          onOpenChange={setUpdateOpen}
        />
      )}
    </>
  );
}
