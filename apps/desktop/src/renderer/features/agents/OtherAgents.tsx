import { Eye, EyeOff } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { cn } from "cn";

import { useGatewayConnection } from "@/features/settings/useGateway";
import { CopyButton } from "@/components/CopyButton";
import { IconButton } from "@/components/IconButton";
import type { Navigate } from "@/lib/navigation";
import { Button } from "@/components/Button";
import { toast } from "@/lib/toast";

const readout =
  "flex h-7 min-w-0 items-center truncate rounded-[7px] bg-tint-1 px-2.5 font-mono text-xs ring-1 ring-border ring-inset";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function OtherAgents({ navigate }: { navigate: Navigate }) {
  const { data: connection } = useGatewayConnection();
  const [revealed, setRevealed] = useState(false);
  const url = connection?.url ?? "";
  const token = connection?.token ?? "";
  const json = JSON.stringify(
    { mcpServers: { openmcp: { type: "http", url, headers: { Authorization: `Bearer ${token}` } } } },
    null,
    2
  );

  return (
    <section className="flex flex-col gap-3 rounded-[10px] p-4 ring-1 ring-border">
      <div className="flex items-start justify-between gap-4">
        <div>
          <b className="mb-0.5 block font-semibold">Other agents</b>
          <p className="text-xs text-muted-foreground">
            Any MCP client that speaks Streamable HTTP can use the gateway with these.
          </p>
        </div>
        <Button
          size="sm"
          disabled={!connection}
          onClick={() =>
            void navigator.clipboard.writeText(json).then(() => toast("Copied a JSON config with the URL and token"))
          }
        >
          Copy JSON config
        </Button>
      </div>
      <Row label="URL">
        <span className={readout}>{url}</span>
        <CopyButton label="Copy URL" value={url} />
      </Row>
      <Row label="Token">
        <span className={readout}>
          <span
            aria-hidden={!revealed}
            className={cn(
              "transition-[filter,letter-spacing] duration-(--d3) ease-(--ease-out)",
              !revealed && "tracking-[.08em] blur-[4px]"
            )}
          >
            {token}
          </span>
        </span>
        <span className="flex gap-0.5">
          <IconButton
            label={revealed ? "Hide token" : "Show token"}
            aria-pressed={revealed}
            onClick={() => setRevealed(!revealed)}
          >
            {revealed ? <EyeOff /> : <Eye />}
          </IconButton>
          <CopyButton label="Copy token" value={token} onCopied={() => toast("Copied the gateway token")} />
        </span>
      </Row>
      <Row label="Header">
        <span className={readout}>Authorization: Bearer &lt;token&gt;</span>
        <span />
      </Row>
      <p className="text-xs text-muted-foreground">
        Change the port or regenerate the token in{" "}
        <button type="button" className="font-medium text-primary hover:underline" onClick={() => navigate("settings")}>
          Settings
        </button>
        .
      </p>
    </section>
  );
}
