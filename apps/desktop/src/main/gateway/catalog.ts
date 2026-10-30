import {
  ProtocolError,
  ProtocolErrorCode,
  UriTemplate,
  type Client,
  type Prompt,
  type Resource,
  type ResourceTemplateType,
  type Tool
} from "@modelcontextprotocol/client";

import type { ServerState } from "@openmcp/contracts";

import type { Supervisor } from "../servers/supervisor";

export type ListKind = "tools" | "prompts" | "resources";
export type CallKind = "tool" | "prompt" | "resource";
export type Target = { serverId: string; serverName: string; name: string };

type Lists = { tools: Tool[]; prompts: Prompt[]; resources: Resource[]; templates: ResourceTemplateType[] };
type Entry = Lists & { name: string; noted: Set<string> };
type Owner = Omit<Target, "name">;
type View = Lists & {
  targets: Record<CallKind, Map<string, Target>>;
  matchers: { template: UriTemplate; owner: Owner }[];
};

type CatalogOptions = {
  supervisor: Pick<Supervisor, "client" | "note">;
  nameOf: (id: string) => string | undefined;
  onChange: (kinds: ListKind[]) => void;
};

const LIST_CHANGED = [
  "notifications/tools/list_changed",
  "notifications/prompts/list_changed",
  "notifications/resources/list_changed"
] as const;

const LABELS: Record<CallKind, string> = { tool: "Tool", prompt: "Prompt", resource: "Resource" };

const exposed = (server: string, name: string) => `${server}__${name}`;

const snapshot = (view: View, kind: ListKind) =>
  JSON.stringify(kind === "resources" ? [view.resources, view.templates] : view[kind]);

function noTemplates(error: unknown): ResourceTemplateType[] {
  if (error instanceof ProtocolError && error.code === ProtocolErrorCode.MethodNotFound) return [];
  throw error;
}

function parseTemplate(uriTemplate: string) {
  try {
    return new UriTemplate(uriTemplate);
  } catch {
    return null;
  }
}

async function fetchLists(client: Client): Promise<Lists> {
  const capabilities = client.getServerCapabilities() ?? {};
  const fresh = { cacheMode: "refresh" } as const;

  const [tools, prompts, resources, templates] = await Promise.all([
    capabilities.tools ? client.listTools(undefined, fresh).then((result) => result.tools) : [],
    capabilities.prompts ? client.listPrompts(undefined, fresh).then((result) => result.prompts) : [],
    capabilities.resources ? client.listResources(undefined, fresh).then((result) => result.resources) : [],
    capabilities.resources
      ? client.listResourceTemplates(undefined, fresh).then((result) => result.resourceTemplates, noTemplates)
      : []
  ]);

  return { tools, prompts, resources, templates };
}

export function createCatalog({ supervisor, nameOf, onChange }: CatalogOptions) {
  const entries = new Map<string, Entry>();
  const generations = new Map<string, number>();
  let view = build();

  function build(): View {
    const next: View = {
      tools: [],
      prompts: [],
      resources: [],
      templates: [],
      targets: { tool: new Map(), prompt: new Map(), resource: new Map() },
      matchers: []
    };
    const sorted = [...entries].sort(([, a], [, b]) => a.name.localeCompare(b.name));

    for (const [serverId, entry] of sorted) {
      const owner: Owner = { serverId, serverName: entry.name };

      const claim = (kind: CallKind, key: string, name: string) => {
        const winner = next.targets[kind].get(key);
        if (!winner) {
          next.targets[kind].set(key, { ...owner, name });
          return true;
        }

        const text = `${LABELS[kind]} ${key} is also provided by ${winner.serverName}; agents will use ${winner.serverName}'s.`;
        if (!entry.noted.has(text)) {
          entry.noted.add(text);
          supervisor.note(serverId, text);
        }
        return false;
      };

      for (const tool of entry.tools) {
        const name = exposed(entry.name, tool.name);
        if (claim("tool", name, tool.name)) next.tools.push({ ...tool, name });
      }
      for (const prompt of entry.prompts) {
        const name = exposed(entry.name, prompt.name);
        if (claim("prompt", name, prompt.name)) next.prompts.push({ ...prompt, name });
      }
      for (const resource of entry.resources) {
        if (claim("resource", resource.uri, resource.uri)) {
          next.resources.push({ ...resource, name: exposed(entry.name, resource.name) });
        }
      }
      for (const template of entry.templates) {
        const parsed = parseTemplate(template.uriTemplate);
        if (!parsed) continue;

        next.templates.push({ ...template, name: exposed(entry.name, template.name) });
        next.matchers.push({ template: parsed, owner });
      }
    }

    return next;
  }

  function update() {
    const before = view;
    view = build();

    const kinds = (["tools", "prompts", "resources"] as const).filter(
      (kind) => snapshot(before, kind) !== snapshot(view, kind)
    );
    if (kinds.length > 0) onChange(kinds);
  }

  function bump(id: string) {
    const generation = (generations.get(id) ?? 0) + 1;
    generations.set(id, generation);
    return generation;
  }

  function drop(id: string) {
    bump(id);
    if (entries.delete(id)) update();
  }

  async function refresh(id: string) {
    const generation = bump(id);
    const client = supervisor.client(id);
    const name = nameOf(id);
    if (!client || !name) return drop(id);

    try {
      const lists = await fetchLists(client);
      if (generations.get(id) !== generation) return;

      entries.set(id, { ...lists, name, noted: new Set() });
    } catch (error) {
      if (generations.get(id) !== generation) return;

      entries.delete(id);
      supervisor.note(
        id,
        `Couldn't list what this server exposes: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    update();
  }

  async function sync(state: ServerState) {
    if (state.status !== "running") return drop(state.id);

    const client = supervisor.client(state.id);
    for (const method of LIST_CHANGED) client?.setNotificationHandler(method, () => void refresh(state.id));

    await refresh(state.id);
  }

  return {
    sync,
    tools: () => view.tools,
    prompts: () => view.prompts,
    resources: () => view.resources,
    templates: () => view.templates,
    resolve(kind: CallKind, name: string): Target | null {
      const target = view.targets[kind].get(name);
      if (target || kind !== "resource") return target ?? null;

      const owner = view.matchers.find(({ template }) => template.match(name))?.owner;
      return owner ? { ...owner, name } : null;
    }
  };
}

export type Catalog = ReturnType<typeof createCatalog>;
