import { Fragment, useState, type ReactNode } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronRight } from "lucide-react";

import type { InstalledServer, ServerState, Tool } from "@openmcp/contracts";

import { useActivitySummary } from "@/features/activity/useActivity";
import { formatCount } from "@/features/activity/activityFormat";
import { SearchField } from "@/components/SearchField";
import { Skeleton } from "@/components/Skeleton";
import { ipcErrorMessage } from "@/lib/ipcError";
import { toolParameters } from "./serverDetails";
import { useServerDetails } from "./useServers";
import { primaryAction } from "./serverStatus";
import { Button } from "@/components/Button";
import { Tag } from "@/components/Tag";

type ToolsTabProps = { server: InstalledServer; state: ServerState; waiting: boolean; onPrimary: () => void };

export function ToolsTab({ server, state, waiting, onPrimary }: ToolsTabProps) {
  if (state.status === "running") return <Capabilities server={server} state={state} />;

  let message = `Start ${server.name} to see its tools.`;
  if (waiting) message = "Waiting for you to finish signing in…";
  else if (state.status === "signin") message = `Sign in to see what ${server.name} offers.`;
  else if (state.status === "starting") message = "Starting…";
  else if (state.status === "error") message = `${server.name} isn’t running. Fix the error to see its tools.`;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <p className="max-w-[300px] text-muted-foreground">{message}</p>
      {!waiting && state.status !== "starting" && (
        <Button size="sm" variant="primary" onClick={onPrimary}>
          {primaryAction(state, false).label}
        </Button>
      )}
    </div>
  );
}

function Capabilities({ server, state }: Pick<ToolsTabProps, "server" | "state">) {
  const details = useServerDetails(state);
  const { data: summary } = useActivitySummary({ range: "24h", serverId: server.id });
  const [query, setQuery] = useState("");

  if (details.isPending)
    return (
      <div className="delayed flex flex-col gap-1.5">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[46px] w-full rounded-[9px]" />
        ))}
      </div>
    );
  if (details.error)
    return (
      <p role="alert" className="text-destructive">
        {ipcErrorMessage(details.error)}
      </p>
    );

  const { prompts, resources } = details.data;
  const tools = details.data.tools ?? [];
  const needle = query.trim().toLowerCase();
  const shown = tools.filter((tool) => `${tool.name}\n${tool.description ?? ""}`.toLowerCase().includes(needle));
  const calls = new Map(
    summary?.groups.filter((group) => group.kind === "tool").map((group) => [group.name, group.calls])
  );

  return (
    <>
      <SearchField
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Filter ${tools.length} tools`}
        aria-label="Filter tools"
      />
      <div className="rounded-[9px] ring-1 ring-border ring-inset">
        {shown.map((tool) => (
          <ToolRow key={tool.name} prefix={server.name} tool={tool} calls={calls.get(tool.name)} />
        ))}
        {shown.length === 0 && (
          <p className="p-6 text-center text-muted-foreground">
            {tools.length ? "No tools match." : "This server has no tools."}
          </p>
        )}
      </div>
      {!!prompts?.length && (
        <Section title="Prompts">
          {prompts.map((prompt) => (
            <Entry key={prompt.name} name={prompt.name} detail={prompt.description} />
          ))}
        </Section>
      )}
      {!!resources?.length && (
        <Section title="Resources">
          {resources.map((resource) => (
            <Entry
              key={resource.uri}
              name={resource.name}
              detail={<span className="font-mono break-all">{resource.uri}</span>}
            />
          ))}
        </Section>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] font-semibold text-muted-foreground">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Entry({ name, detail }: { name: string; detail?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <b className="font-mono text-xs font-semibold">{name}</b>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </div>
  );
}

function ToolRow({ prefix, tool, calls }: { prefix: string; tool: Tool; calls?: number }) {
  const parameters = toolParameters(tool.inputSchema);

  return (
    <Collapsible.Root className="[&+&]:border-t">
      <Collapsible.Trigger className="group flex min-h-[46px] w-full items-center gap-2.5 px-3 py-1.5 text-left outline-none focus-visible:focus-halo">
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-(--d3) ease-(--ease-move) group-data-panel-open:rotate-90" />
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="truncate font-mono text-xs font-semibold">{tool.name}</b>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {prefix}__{tool.name}
          </span>
        </span>
        {tool.annotations?.readOnlyHint && <Tag>Read-only</Tag>}
        {tool.annotations?.destructiveHint && <Tag tone="danger">Destructive</Tag>}
        <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          {calls ? formatCount(calls) : "—"}
        </span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-(--d3) ease-(--ease-move) data-ending-style:h-0 data-starting-style:h-0">
        <div className="flex flex-col gap-2.5 pr-3 pb-3 pl-9">
          {tool.description ? (
            <p className="whitespace-pre-line">{tool.description}</p>
          ) : (
            <p className="text-muted-foreground italic">No description.</p>
          )}
          {parameters.length === 0 ? (
            <p className="text-xs text-muted-foreground">Takes no parameters.</p>
          ) : (
            <dl className="grid grid-cols-[auto_auto_auto_1fr] items-baseline gap-x-3 gap-y-1 text-xs">
              {parameters.map((field) => (
                <Fragment key={field.name}>
                  <dt className="font-mono font-semibold">{field.name}</dt>
                  <dd className="font-mono text-muted-foreground">{field.type}</dd>
                  <dd className="text-muted-foreground">{field.required ? "required" : "optional"}</dd>
                  <dd className="text-muted-foreground">{field.description}</dd>
                </Fragment>
              ))}
            </dl>
          )}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
