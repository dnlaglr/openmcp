import { useRef, useState, type ReactNode } from "react";

import { CATALOG_MIN_QUERY, type AvailableUpdate, type CatalogEntry } from "@openmcp/contracts";

import { useServers, useServerStates } from "@/features/servers/useServers";
import { useCatalogSearch, useDebounced, usePopular } from "./useCatalog";
import { UpdateServerSheet } from "@/features/servers/UpdateServerSheet";
import { useFindShortcut } from "@/hooks/useFindShortcut";
import { SearchField } from "@/components/SearchField";
import { useVisibility } from "@/hooks/useVisibility";
import type { CatalogActions } from "./EntryActions";
import { ErrorState } from "@/components/ErrorState";
import { StatusLed } from "@/components/StatusLed";
import type { PageProps } from "@/lib/navigation";
import { Skeleton } from "@/components/Skeleton";
import { RuntimeBanner } from "./RuntimeBanner";
import { Toolbar } from "@/components/Toolbar";
import { InstallSheet } from "./InstallSheet";
import { CatalogCard } from "./CatalogCard";
import { ResultRow } from "./ResultRow";

const SEARCH_DELAY_MS = 300;
const OFFLINE = "Couldn’t reach the MCP Registry";
const OFFLINE_HINT = "Your installed servers keep working. Check your connection and try again.";
const cards = "grid grid-cols-4 gap-3";
const findKey = document.documentElement.dataset.platform === "mac" ? "⌘ F" : "Ctrl F";

function SectionHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-2.5 flex items-baseline gap-2.5">
      <h2 className="text-[13px] font-semibold">{title}</h2>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}

function Popular({ actions }: { actions: CatalogActions }) {
  const popular = usePopular();

  if (popular.error)
    return (
      <ErrorState
        title={OFFLINE}
        description={OFFLINE_HINT}
        error={popular.error}
        onRetry={() => void popular.refetch()}
      />
    );

  return (
    <>
      {popular.data && <RuntimeBanner runners={popular.data.map((entry) => entry.runner)} />}
      <section>
        <SectionHead title="Popular" hint="Picked for most setups. All of them run locally." />
        <div className={cards}>
          {popular.data
            ? popular.data.map((entry, index) => (
                <CatalogCard key={entry.name} entry={entry} index={index} actions={actions} />
              ))
            : Array.from({ length: 8 }, (_, index) => (
                <div
                  key={index}
                  className="delayed flex h-[150px] flex-col gap-2.5 rounded-[10px] p-3.5 ring-1 ring-border"
                >
                  <Skeleton className="w-1/2" />
                  <Skeleton className="w-4/5" />
                  <Skeleton className="w-11/12" />
                  <Skeleton className="w-3/5" />
                </div>
              ))}
        </div>
      </section>
    </>
  );
}

type ResultsProps = { query: string; actions: CatalogActions; onAddCustom: () => void };

function Results({ query, actions, onAddCustom }: ResultsProps) {
  const results = useCatalogSearch(query);
  const end = useRef<HTMLDivElement>(null);

  useVisibility(end, (visible) => {
    if (visible && results.hasNextPage && !results.isFetchingNextPage) void results.fetchNextPage();
  });

  if (results.error)
    return (
      <ErrorState
        title={OFFLINE}
        description={OFFLINE_HINT}
        error={results.error}
        onRetry={() => void results.refetch()}
      />
    );

  const entries = results.data?.pages.flatMap((page) => page.entries) ?? [];
  const count = `${entries.length}${results.hasNextPage ? "+" : ""}`;
  const title = `${count} ${count === "1" ? "result" : "results"} for “${query}”`;

  let content: ReactNode = (
    <div className="delayed rounded-[10px] ring-1 ring-border">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="grid min-h-14 grid-cols-[220px_minmax(0,1fr)_70px] items-center gap-4 px-3.5 [&+&]:border-t"
        >
          <Skeleton className="w-3/4" />
          <Skeleton className="w-5/6" />
          <Skeleton className="w-10" />
        </div>
      ))}
    </div>
  );
  if (results.data && entries.length === 0)
    content = (
      <div className="flex animate-up flex-col items-center gap-2 px-5 py-10 text-center text-muted-foreground">
        <b className="font-semibold text-foreground">No installable servers match “{query}”</b>
        <span>
          The registry lists servers with an npm, PyPI or Docker package, or a remote URL. For anything else, add it
          yourself.
        </span>
        <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={onAddCustom}>
          Add a custom server →
        </button>
      </div>
    );
  else if (results.data)
    content = (
      <div className="rounded-[10px] ring-1 ring-border">
        {entries.map((entry, index) => (
          <ResultRow key={entry.name} entry={entry} index={index} actions={actions} />
        ))}
      </div>
    );

  return (
    <section>
      <SectionHead
        title={results.data ? title : `Searching for “${query}”…`}
        hint="Only servers OpenMCP can install are listed."
      />
      {content}
      {results.isFetchingNextPage && (
        <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <StatusLed status="starting" />
          Loading more from the registry…
        </p>
      )}
      <div ref={end} />
    </section>
  );
}

export function CatalogPage({ navigate }: PageProps) {
  const [search, setSearch] = useState("");
  const [installing, setInstalling] = useState<{ entry: CatalogEntry; opened: number } | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [updating, setUpdating] = useState<AvailableUpdate | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const { data: servers = [] } = useServers();
  const stateOf = useServerStates();
  const field = useRef<HTMLInputElement>(null);
  useFindShortcut(field);

  const typed = search.trim();
  const query = useDebounced(typed, SEARCH_DELAY_MS);
  const updatingServer = servers.find((server) => server.id === updating?.serverId);

  const actions: CatalogActions = {
    install: (entry) => {
      setInstalling({ entry, opened: Date.now() });
      setInstallOpen(true);
    },
    update: (update) => {
      setUpdating(update);
      setUpdateOpen(true);
    },
    open: (server) => navigate("servers", { serverId: server.id })
  };

  let content: ReactNode = <Results query={query} actions={actions} onAddCustom={() => navigate("servers")} />;
  if (typed.length === 0) content = <Popular actions={actions} />;
  else if (typed.length < CATALOG_MIN_QUERY)
    content = (
      <p className="text-xs text-muted-foreground">
        Keep typing. Search starts at 3 characters and matches server names.
      </p>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar title="Catalog" subtitle="From the official MCP Registry">
        <span className="relative">
          <SearchField
            ref={field}
            autoFocus
            className="w-[300px]"
            placeholder="Search server names"
            aria-label="Search servers"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {!search && (
            <kbd className="pointer-events-none absolute top-1/2 right-[7px] -translate-y-1/2 rounded px-[5px] py-[3px] font-mono text-[10.5px] leading-none font-medium text-muted-foreground ring-1 ring-border ring-inset">
              {findKey}
            </kbd>
          )}
        </span>
      </Toolbar>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-6 pt-4 pb-8">{content}</div>

      {installing && (
        <InstallSheet
          key={`${installing.entry.name}-${installing.opened}`}
          open={installOpen}
          onOpenChange={setInstallOpen}
          onClosed={() => setInstalling(null)}
          entry={installing.entry}
          navigate={navigate}
        />
      )}
      {updating && updatingServer && (
        <UpdateServerSheet
          key={`${updating.serverId}:${updating.entry.version}:${updating.inputsChanged}`}
          open={updateOpen}
          onOpenChange={setUpdateOpen}
          onClosed={() => setUpdating(null)}
          update={updating}
          server={updatingServer}
          state={stateOf(updatingServer.id)}
        />
      )}
    </div>
  );
}
