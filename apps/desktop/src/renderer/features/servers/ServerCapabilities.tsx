import { Fragment, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import type { Prompt, Resource, Tool } from "@openmcp/contracts";

import { toolParameters, type Field } from "./serverDetails";
import { Badge } from "@/components/ui/badge";

const hints = [
  ["readOnlyHint", "Read-only"],
  ["destructiveHint", "Destructive"],
  ["idempotentHint", "Idempotent"],
  ["openWorldHint", "Open world"]
] as const;

export function ToolList({ tools }: { tools: Tool[] }) {
  if (tools.length === 0) return <EmptyList>This server has no tools.</EmptyList>;

  return (
    <>
      {tools.map((tool) => (
        <Expandable
          key={tool.name}
          name={tool.name}
          title={tool.title ?? tool.annotations?.title}
          badges={hints
            .filter(([hint]) => tool.annotations?.[hint])
            .map(([hint, label]) => (
              <Badge key={hint} variant={hint === "destructiveHint" ? "destructive" : "secondary"}>
                {label}
              </Badge>
            ))}
        >
          <Description text={tool.description} />
          <Fields fields={toolParameters(tool.inputSchema)} empty="Takes no parameters." />
        </Expandable>
      ))}
    </>
  );
}

export function PromptList({ prompts }: { prompts: Prompt[] }) {
  if (prompts.length === 0) return <EmptyList>This server has no prompts.</EmptyList>;

  return (
    <>
      {prompts.map((prompt) => (
        <Expandable key={prompt.name} name={prompt.name} title={prompt.title}>
          <Description text={prompt.description} />
          <Fields
            fields={(prompt.arguments ?? []).map((argument) => ({
              name: argument.name,
              type: "string",
              required: argument.required ?? false,
              description: argument.description
            }))}
            empty="Takes no arguments."
          />
        </Expandable>
      ))}
    </>
  );
}

export function ResourceList({ resources }: { resources: Resource[] }) {
  if (resources.length === 0) return <EmptyList>This server has no resources.</EmptyList>;

  return (
    <>
      {resources.map((resource) => (
        <Expandable
          key={resource.uri}
          name={resource.name}
          title={resource.title}
          badges={resource.mimeType && <Badge variant="outline">{resource.mimeType}</Badge>}
        >
          <Description text={resource.description} />
          <p className="font-mono text-xs break-all text-muted-foreground">{resource.uri}</p>
        </Expandable>
      ))}
    </>
  );
}

function Expandable({
  name,
  title,
  badges,
  children
}: {
  name: string;
  title?: string;
  badges?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="group border-b last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-2.5 select-none [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        <span className="font-mono text-sm font-medium">{name}</span>
        {title && <span className="truncate text-muted-foreground">{title}</span>}
        <span className="ml-auto flex shrink-0 gap-1">{badges}</span>
      </summary>
      <div className="flex flex-col gap-3 pb-4 pl-6">{children}</div>
    </details>
  );
}

function Description({ text }: { text?: string }) {
  if (!text) return <p className="text-muted-foreground italic">No description.</p>;

  return <p className="whitespace-pre-line">{text}</p>;
}

function Fields({ fields, empty }: { fields: Field[]; empty: string }) {
  if (fields.length === 0) return <p className="text-muted-foreground">{empty}</p>;

  return (
    <dl className="grid grid-cols-[auto_auto_auto_1fr] items-baseline gap-x-4 gap-y-1.5">
      {fields.map((field) => (
        <Fragment key={field.name}>
          <dt className="font-mono text-xs font-medium">{field.name}</dt>
          <dd className="font-mono text-xs text-muted-foreground">{field.type}</dd>
          <dd className="text-xs text-muted-foreground">{field.required ? "required" : "optional"}</dd>
          <dd className="text-muted-foreground">{field.description}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function EmptyList({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-muted-foreground">{children}</p>;
}
