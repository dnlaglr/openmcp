import { CircleAlert, CircleArrowUp, KeyRound, Lock } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import {
  launchLabel,
  secretNames,
  type AvailableUpdate,
  type InstalledServer,
  type ServerState
} from "@openmcp/contracts";

import { formatAgo, formatCount, formatDuration, formatRate } from "@/features/activity/activityFormat";
import { useActivitySummary, useActivityTrail } from "@/features/activity/useActivity";
import { useServerDetails, useServerLogs, useSetAutostart } from "./useServers";
import { Disclosure } from "@/components/Disclosure";
import { StatusLed } from "@/components/StatusLed";
import type { Navigate } from "@/lib/navigation";
import { Skeleton } from "@/components/Skeleton";
import { KeyValue } from "@/components/KeyValue";
import { Callout } from "@/components/Callout";
import { Button } from "@/components/Button";
import { Switch } from "@/components/Switch";
import { formatTime } from "./serverDetails";

const dates = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const link = "text-xs font-medium text-primary hover:underline";

type OverviewTabProps = {
  server: InstalledServer;
  state: ServerState;
  update?: AvailableUpdate;
  waiting: boolean;
  onPrimary: () => void;
  onLogs: () => void;
  onEdit: () => void;
  onUpdate: () => void;
  navigate: Navigate;
};

export function OverviewTab(props: OverviewTabProps) {
  const { server, state, update, waiting, onPrimary, onLogs, onEdit, onUpdate, navigate } = props;

  return (
    <>
      <StateCallout server={server} state={state} waiting={waiting} onPrimary={onPrimary} onLogs={onLogs} />
      {update && (
        <Callout
          tone="accent"
          icon={<CircleArrowUp />}
          title={`Version ${update.entry.version} is available`}
          actions={
            <Button size="sm" onClick={onUpdate}>
              Update…
            </Button>
          }
        >
          <p className="text-xs text-muted-foreground">You’re on {update.from}. Settings carry over.</p>
        </Callout>
      )}
      <Usage server={server} navigate={navigate} />
      <Setup server={server} onEdit={onEdit} />
      <Details server={server} state={state} />
    </>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

const note = (text: ReactNode) => <p className="text-xs text-muted-foreground">{text}</p>;

type StateProps = Pick<OverviewTabProps, "server" | "state" | "waiting" | "onPrimary" | "onLogs">;

function StateCallout({ server, state, waiting, onPrimary, onLogs }: StateProps) {
  if (waiting)
    return (
      <Callout
        tone="accent"
        icon={<StatusLed status="starting" />}
        title="Waiting for your browser…"
        actions={
          <Button size="sm" onClick={onPrimary}>
            Start over
          </Button>
        }
      >
        {note("Finish signing in there. Closed the tab by accident? Start over.")}
      </Callout>
    );

  if (state.status === "error")
    return <ErrorCallout server={server} state={state} onPrimary={onPrimary} onLogs={onLogs} />;

  if (state.status === "signin") {
    const host = server.launch.type === "http" ? new URL(server.launch.url).host : server.name;
    return (
      <Callout
        tone="warn"
        icon={<KeyRound />}
        title={`Sign in to use ${server.name}`}
        actions={
          <Button size="sm" variant="primary" onClick={onPrimary}>
            Sign in
          </Button>
        }
      >
        {note(`Your browser opens ${host}’s sign-in page. The token it returns is kept in your OS keychain.`)}
      </Callout>
    );
  }

  if (state.status === "stopped")
    return (
      <Callout
        title={`${server.name} is stopped`}
        actions={
          <Button size="sm" variant="primary" onClick={onPrimary}>
            Start
          </Button>
        }
      >
        {note("Agents can’t use its tools until it runs.")}
      </Callout>
    );

  return null;
}

function ErrorCallout({ server, state, onPrimary, onLogs }: Omit<StateProps, "waiting">) {
  const { data: lines = [] } = useServerLogs(server.id);

  return (
    <Callout
      tone="danger"
      icon={<CircleAlert />}
      title={`${server.name} couldn’t start`}
      actions={
        <>
          <Button size="sm" variant="primary" onClick={onPrimary}>
            Retry
          </Button>
          <Button size="sm" onClick={onLogs}>
            View logs
          </Button>
          {state.restarts > 0 && (
            <span className="ml-auto text-[11px] text-muted-foreground">
              Gave up after {state.restarts} {state.restarts === 1 ? "restart" : "restarts"}
            </span>
          )}
        </>
      }
    >
      {state.error && <p className="text-xs">{state.error}</p>}
      {lines.length > 0 && (
        <div className="rounded-md bg-tint-1 px-2 py-1.5 font-mono text-[11.5px] leading-[18px]">
          {lines.slice(-3).map((line, index) => (
            <div key={index} className="flex gap-2.5">
              <span className="shrink-0 text-muted-foreground tabular-nums">{formatTime(line.at)}</span>
              <span className="min-w-0 break-all">{line.text}</span>
            </div>
          ))}
        </div>
      )}
    </Callout>
  );
}

function Kpi({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[9px] bg-tint-1 px-3 py-2 ring-1 ring-border ring-inset">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <b className="text-[17px] leading-[22px] font-semibold tabular-nums">{children}</b>
    </div>
  );
}

function Usage({ server, navigate }: Pick<OverviewTabProps, "server" | "navigate">) {
  const scope = { range: "24h", serverId: server.id } as const;
  const { data: summary } = useActivitySummary(scope);
  const { data: trail, refetch } = useActivityTrail(scope, false);

  useEffect(() => window.api.on("activity:changed", () => void refetch()), [refetch]);

  const last = trail?.pages[0]?.[0];
  const top = summary?.groups.slice(0, 3) ?? [];
  const max = Math.max(1, ...top.map((group) => group.calls));

  let body: ReactNode = <Skeleton className="w-2/3" />;
  if (summary && summary.totals.calls === 0) body = note("No calls in the last 24 hours.");
  else if (summary)
    body = (
      <>
        <div className="grid grid-cols-3 gap-2">
          <Kpi label="Calls">
            <span key={summary.totals.calls} className="inline-block animate-up">
              {formatCount(summary.totals.calls)}
            </span>
          </Kpi>
          <Kpi label="Failed">{formatRate(summary.totals.failures, summary.totals.calls)}</Kpi>
          <Kpi label="p95">{formatDuration(summary.totals.p95)}</Kpi>
        </div>
        {note(`${last ? `Last call ${formatAgo(last.at)}. ` : ""}Most used:`)}
        <div className="flex flex-col gap-1.5">
          {top.map((group) => (
            <div
              key={`${group.kind}:${group.name}`}
              className="grid grid-cols-[132px_minmax(0,1fr)_auto] items-center gap-2.5 text-xs"
            >
              <span className="truncate font-mono">{group.name}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-tint-2">
                <span
                  className="block h-full origin-left animate-[grow_var(--d4)_var(--ease-out)_both] rounded-full bg-primary transition-[width] duration-(--d3) ease-(--ease-move)"
                  style={{ width: `${(group.calls / max) * 100}%` }}
                />
              </span>
              <span className="text-right text-muted-foreground tabular-nums">{formatCount(group.calls)}</span>
            </div>
          ))}
        </div>
      </>
    );

  return (
    <Section
      title="Last 24 hours"
      action={
        <button type="button" className={link} onClick={() => navigate("activity", { serverId: server.id })}>
          Open in Activity →
        </button>
      }
    >
      {body}
    </Section>
  );
}

function Setup({ server, onEdit }: Pick<OverviewTabProps, "server" | "onEdit">) {
  const setAutostart = useSetAutostart();
  const { launch } = server;
  const remote = launch.type === "http";
  const plain = Object.entries(remote ? launch.headers : launch.env);
  const secrets = secretNames(launch);
  const autostart = setAutostart.isPending ? setAutostart.variables.autostart : server.autostart;

  return (
    <Section
      title="Setup"
      action={
        <button type="button" className={link} onClick={onEdit}>
          Edit…
        </button>
      }
    >
      <KeyValue label={remote ? "URL" : "Command"}>
        <span className="font-mono text-xs">{launchLabel(launch)}</span>
      </KeyValue>
      <KeyValue top label={remote ? "Headers" : "Environment"}>
        {plain.length + secrets.length === 0 ? (
          <span className="text-muted-foreground">None</span>
        ) : (
          <span className="flex flex-col gap-0.5 font-mono text-xs">
            {plain.map(([name, value]) => (
              <span key={name} className="flex gap-2">
                <span>{name}</span>
                <span className="truncate text-muted-foreground">{value}</span>
              </span>
            ))}
            {secrets.map((name) => (
              <span key={name} className="flex items-center gap-1.5">
                <span>{name}</span>
                <Lock aria-hidden className="size-3 text-muted-foreground" />
                <span className="font-sans text-muted-foreground">In keychain</span>
              </span>
            ))}
          </span>
        )}
      </KeyValue>
      <KeyValue label="Start at launch">
        <Switch
          size="sm"
          aria-label="Start when OpenMCP launches"
          checked={autostart}
          onCheckedChange={(next) => setAutostart.mutate({ id: server.id, autostart: next })}
        />
      </KeyValue>
      <KeyValue label="Source">
        {server.source === "registry" ? `MCP Registry · v${server.version}` : "Added by you"}
      </KeyValue>
    </Section>
  );
}

function Details({ server, state }: Pick<OverviewTabProps, "server" | "state">) {
  const { data: details } = useServerDetails(state);
  const info = details?.info;

  return (
    <Disclosure title="Details">
      {server.launch.type === "http" ? (
        <KeyValue label="Host">{new URL(server.launch.url).host}</KeyValue>
      ) : (
        <KeyValue label="Process ID">{state.pid ?? "—"}</KeyValue>
      )}
      <KeyValue label="Protocol">{details?.protocolVersion ?? "—"}</KeyValue>
      <KeyValue label="Reports as">{info ? `${info.title ?? info.name} ${info.version}` : "—"}</KeyValue>
      <KeyValue label="Added">{dates.format(server.createdAt)}</KeyValue>
    </Disclosure>
  );
}
