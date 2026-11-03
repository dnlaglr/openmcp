import { cn } from "cn";

import type { ClientId } from "@openmcp/contracts";

import cursorLight from "@/assets/agents/cursor-light.svg";
import codexLight from "@/assets/agents/codex-light.svg";
import cursorDark from "@/assets/agents/cursor-dark.svg";
import codexDark from "@/assets/agents/codex-dark.svg";
import vscode from "@/assets/agents/vscode.svg";
import claude from "@/assets/agents/claude.svg";

type Logo = { light: string; dark?: string; className?: string };

const logos: Record<ClientId, Logo> = {
  "claude-desktop": { light: claude },
  "claude-code": { light: claude },
  cursor: { light: cursorLight, dark: cursorDark },
  vscode: { light: vscode },
  // OpenAI's Blossom file pads the mark to half its size.
  codex: { light: codexLight, dark: codexDark, className: "scale-200" }
};

export function AgentLogo({ id }: { id: ClientId }) {
  const { light, dark, className } = logos[id];

  return (
    <span className="bevel grid size-8 shrink-0 place-items-center rounded-lg">
      <picture>
        {dark && <source srcSet={dark} media="(prefers-color-scheme: dark)" />}
        <img src={light} alt="" className={cn("block size-[18px]", className)} />
      </picture>
    </span>
  );
}
