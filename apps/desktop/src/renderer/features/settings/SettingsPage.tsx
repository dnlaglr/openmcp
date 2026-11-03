import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";

import { GatewayPort } from "@openmcp/contracts";

import { useGatewayConnection, useGatewayState, useRegenerateGatewayToken, useSetGatewayPort } from "./useGateway";
import { RELEASES_URL, REPOSITORY_URL, restartToUpdate } from "@/lib/updates";
import { useAppearance, useSetAppearance } from "./useAppearance";
import type { Navigate, PageProps } from "@/lib/navigation";
import { useClients } from "@/features/agents/useClients";
import { useUpdateState } from "@/hooks/useUpdateState";
import { ThemePicker } from "@/components/ThemePicker";
import { ipcErrorMessage } from "@/lib/ipcError";
import { AlertSheet } from "@/components/Sheet";
import { Callout } from "@/components/Callout";
import { Toolbar } from "@/components/Toolbar";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

const link = "font-medium text-primary hover:underline";
const hint = "text-[11.5px] leading-[15px] text-muted-foreground";
const list = new Intl.ListFormat(undefined, { type: "conjunction" });
const dark = matchMedia("(prefers-color-scheme: dark)");

const subscribe = (callback: () => void) => {
  dark.addEventListener("change", callback);
  return () => dark.removeEventListener("change", callback);
};

function osName() {
  if (navigator.userAgent.includes("Windows")) return "Windows";
  if (navigator.userAgent.includes("Macintosh")) return "macOS";
  return null;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 ml-0.5 text-[11px] font-semibold text-muted-foreground">{title}</h2>
      <div className="rounded-[10px] ring-1 ring-border">{children}</div>
    </section>
  );
}

function Row({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-4 px-4 py-3.5 [&+&]:border-t">
      <label htmlFor={htmlFor} className="pt-1.5 text-xs text-muted-foreground">
        {label}
      </label>
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </div>
  );
}

function useConnectedNames() {
  const { data: clients = [] } = useClients();
  return clients.filter((client) => client.status === "connected").map((client) => client.name);
}

function Theme() {
  const { data: appearance = "system" } = useAppearance();
  const setAppearance = useSetAppearance();
  const systemDark = useSyncExternalStore(subscribe, () => dark.matches);
  const os = osName();

  const text =
    appearance === "system"
      ? `Follows your ${os ?? "system"} setting, which is ${systemDark ? "Dark" : "Light"} right now.`
      : `Always ${appearance}, whatever ${os ?? "your system"} is set to.`;

  return (
    <Row label="Theme">
      <ThemePicker value={appearance} onChange={(next) => void setAppearance(next)} />
      <p className={hint}>{text} The title bar and tray menu follow it too.</p>
    </Row>
  );
}

function Port({ navigate }: { navigate: Navigate }) {
  const { data: state } = useGatewayState();
  const setPort = useSetGatewayPort();
  const names = useConnectedNames();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [moved, setMoved] = useState<number | null>(null);

  const current = state?.port;
  const port = draft ?? String(current ?? "");
  const error =
    invalid ??
    (setPort.error ? ipcErrorMessage(setPort.error) : null) ??
    (state?.status === "error" ? state.error : null);

  function save(event: FormEvent) {
    event.preventDefault();

    const parsed = GatewayPort.safeParse(Number(port));
    if (!parsed.success) return setInvalid(parsed.error.issues[0].message);

    setInvalid(null);
    setPort.mutate(parsed.data, {
      onSuccess: () => {
        setDraft(null);
        setMoved(parsed.data);
      }
    });
  }

  let title = `The gateway moved to :${moved}.`;
  if (names.length > 0) title = `${list.format(names)} ${names.length === 1 ? "now uses" : "now use"} :${moved}.`;

  return (
    <Row label="Port" htmlFor="gateway-port">
      <form onSubmit={save} className="flex flex-wrap items-center gap-2">
        <Input
          id="gateway-port"
          inputMode="numeric"
          mono
          invalid={!!error}
          className="w-24"
          value={port}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(null);
          }}
        />
        <Button
          type="submit"
          aria-label="Save port"
          busy={setPort.isPending}
          disabled={setPort.isPending || port === String(current)}
        >
          {setPort.isPending ? "Moving…" : "Save"}
        </Button>
        {current !== undefined && (
          <span className="text-xs text-muted-foreground">
            Agents connect at <span className="font-mono">http://127.0.0.1:{current}/mcp</span>
          </span>
        )}
      </form>
      {error && (
        <p role="alert" className="animate-up text-[11.5px] leading-[15px] text-destructive">
          {error}
        </p>
      )}
      {moved !== null && state?.status === "running" && state.port === moved && (
        <Callout tone="ok" icon={<CircleCheck />} title={title}>
          <p className="text-xs">
            Agents you set up by hand need the new address from{" "}
            <button type="button" className={link} onClick={() => navigate("agents")}>
              Agents
            </button>
            .
          </p>
        </Callout>
      )}
    </Row>
  );
}

function Token({ navigate }: { navigate: Navigate }) {
  const { data: connection } = useGatewayConnection();
  const regenerate = useRegenerateGatewayToken();
  const names = useConnectedNames();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <Row label="Token">
      <div className="flex items-center gap-2">
        <span className="flex h-7 min-w-0 flex-1 items-center overflow-hidden rounded-[7px] bg-tint-1 px-2.5 font-mono text-xs ring-1 ring-border ring-inset">
          <span aria-hidden className="truncate tracking-[.08em] blur-[4px]">
            {connection?.token}
          </span>
        </span>
        <Button
          onClick={() => {
            regenerate.reset();
            setOpen(true);
          }}
        >
          Regenerate…
        </Button>
      </div>
      <p className={hint}>
        Agents send it in an Authorization header. You can copy it from{" "}
        <button type="button" className={link} onClick={() => navigate("agents")}>
          Agents → Other agents
        </button>
        .
      </p>
      {done && (
        <Callout tone="ok" icon={<CircleCheck />} title="New token created.">
          {names.length > 0 && <p className="text-xs">{list.format(names)} have the new token.</p>}
        </Callout>
      )}
      <AlertSheet
        open={open}
        onOpenChange={setOpen}
        title="Regenerate the gateway token?"
        description="Every agent using the current token loses access right away. OpenMCP then gives the new one to the agents it connected."
        confirmLabel="Regenerate"
        pending={regenerate.isPending}
        error={regenerate.error && ipcErrorMessage(regenerate.error)}
        onConfirm={() =>
          regenerate.mutate(undefined, {
            onSuccess: () => {
              setOpen(false);
              setDone(true);
            }
          })
        }
      />
    </Row>
  );
}

function About() {
  const { data: version } = useQuery({
    queryKey: ["app-version"],
    queryFn: () => window.api.invoke("app:version"),
    staleTime: Infinity
  });
  const { data: update } = useUpdateState();

  let status = "Up to date";
  if (update?.status === "downloading") status = `Downloading ${update.version} · ${update.percent}%`;
  else if (update?.status === "ready") status = `${update.version} is ready`;
  else if (update?.status === "manual") status = `${update.version} is available`;

  return (
    <Group title="About">
      <Row label="Version">
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <span>OpenMCP {version}</span>
          <span className="text-xs text-muted-foreground">{status}</span>
          {update?.status === "ready" && (
            <Button size="sm" variant="primary" onClick={restartToUpdate}>
              Restart to update
            </Button>
          )}
          {update?.status === "manual" && (
            <Button size="sm" onClick={() => void window.api.invoke("updater:install")}>
              Download from GitHub
            </Button>
          )}
        </div>
      </Row>
      <Row label="Updates">
        <p className="pt-1 text-xs text-muted-foreground">
          OpenMCP downloads new versions in the background and never restarts on its own.
        </p>
        <div className="flex gap-3 text-xs">
          <a href={RELEASES_URL} target="_blank" rel="noreferrer" className={link}>
            Release notes
          </a>
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className={link}>
            GitHub
          </a>
        </div>
      </Row>
    </Group>
  );
}

export function SettingsPage({ navigate }: PageProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar title="Settings" subtitle="Appearance, gateway and updates" />
      <div className="min-h-0 flex-1 overflow-auto px-6 pt-6 pb-10">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-[30px]">
          <Group title="Appearance">
            <Theme />
          </Group>
          <Group title="Gateway">
            <Port navigate={navigate} />
            <Token navigate={navigate} />
          </Group>
          <About />
        </div>
      </div>
    </div>
  );
}
