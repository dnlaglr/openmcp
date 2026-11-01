import { useState } from "react";

import { parsePastedConfig } from "./pasteConfig";
import type { ServerForm } from "./serverForm";
import { Textarea } from "@/components/Input";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";

type PasteConfigProps = { onFill: (patch: Partial<ServerForm>, skipped: number) => void; onCancel: () => void };

export function PasteConfigForm({ onFill, onCancel }: PasteConfigProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function fill() {
    const result = parsePastedConfig(text);
    if (result.ok) onFill(result.patch, result.skipped);
    else setError(result.error);
  }

  return (
    <div className="flex animate-up flex-col gap-2 rounded-[9px] bg-tint-1 p-3 ring-1 ring-border ring-inset">
      <Field id="server-paste" label="An mcpServers snippet from a README, or a command line" error={error}>
        <Textarea
          id="server-paste"
          mono
          rows={7}
          autoFocus
          value={text}
          invalid={!!error}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={fill}>
          Fill in the form
        </Button>
      </div>
    </div>
  );
}
