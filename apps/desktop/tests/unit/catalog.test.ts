import { ProtocolError, ProtocolErrorCode, type Client } from "@modelcontextprotocol/client";
import { expect, test, vi } from "vitest";

import type { ServerState } from "@openmcp/contracts";

import { createCatalog, type ListKind } from "../../src/main/gateway/catalog";

type Exposes = { tools?: string[]; prompts?: string[]; resources?: string[]; templates?: string[] };
type Fake = { exposes: Exposes; gate?: Promise<void>; fail?: Error; noTemplates?: boolean };

const state = (id: string, status: ServerState["status"]): ServerState => ({
  id,
  status,
  error: null,
  restarts: 0,
  pid: null,
  startedAt: null
});

function fakeClient(fake: Fake) {
  const handlers = new Map<string, () => void>();

  const client = {
    getServerCapabilities: () => ({ tools: {}, prompts: {}, resources: {} }),
    listTools: async () => {
      await fake.gate;
      if (fake.fail) throw fake.fail;
      return { tools: (fake.exposes.tools ?? []).map((name) => ({ name, inputSchema: { type: "object" } })) };
    },
    listPrompts: async () => ({ prompts: (fake.exposes.prompts ?? []).map((name) => ({ name })) }),
    listResources: async () => ({
      resources: (fake.exposes.resources ?? []).map((uri) => ({ uri, name: new URL(uri).hostname }))
    }),
    listResourceTemplates: async () => {
      if (fake.noTemplates) throw new ProtocolError(ProtocolErrorCode.MethodNotFound, "Method not found");
      return {
        resourceTemplates: (fake.exposes.templates ?? []).map((uriTemplate) => ({ uriTemplate, name: "by-name" }))
      };
    },
    setNotificationHandler: (method: string, handler: () => void) => void handlers.set(method, handler)
  };

  return { client: client as unknown as Client, listChanged: (method: string) => handlers.get(method)?.() };
}

function setup(servers: Record<string, Fake>) {
  const fakes = new Map(Object.entries(servers).map(([name, fake]) => [name, fakeClient(fake)]));
  const notes: [string, string][] = [];
  const changes: ListKind[][] = [];

  const catalog = createCatalog({
    supervisor: {
      client: (id) => fakes.get(id)?.client,
      note: (id, text) => void notes.push([id, text])
    },
    nameOf: (id) => (fakes.has(id) ? id : undefined),
    onChange: (kinds) => void changes.push(kinds)
  });

  return {
    catalog,
    notes,
    changes,
    start: (...ids: string[]) => Promise.all(ids.map((id) => catalog.sync(state(id, "running")))),
    stop: (id: string) => catalog.sync(state(id, "stopped")),
    listChanged: (id: string, method: string) => fakes.get(id)?.listChanged(method)
  };
}

test("prefixes names with the server and keeps URIs as they are", async () => {
  const { catalog, start } = setup({
    github: {
      exposes: {
        tools: ["create_issue"],
        prompts: ["triage"],
        resources: ["repo://openmcp"],
        templates: ["repo://{name}"]
      }
    }
  });

  await start("github");

  expect(catalog.tools().map((tool) => tool.name)).toEqual(["github__create_issue"]);
  expect(catalog.prompts().map((prompt) => prompt.name)).toEqual(["github__triage"]);
  expect(catalog.resources()).toEqual([{ uri: "repo://openmcp", name: "github__openmcp" }]);
  expect(catalog.templates()).toEqual([{ uriTemplate: "repo://{name}", name: "github__by-name" }]);
});

test("orders servers by name", async () => {
  const { catalog, start } = setup({
    zeta: { exposes: { tools: ["search"] } },
    alpha: { exposes: { tools: ["search"] } }
  });

  await start("zeta", "alpha");

  expect(catalog.tools().map((tool) => tool.name)).toEqual(["alpha__search", "zeta__search"]);
});

test("resolves exposed names back to the owning server and its original name", async () => {
  const { catalog, start } = setup({ github: { exposes: { tools: ["create_issue"], prompts: ["triage"] } } });

  await start("github");

  expect(catalog.resolve("tool", "github__create_issue")).toEqual({
    serverId: "github",
    serverName: "github",
    name: "create_issue"
  });
  expect(catalog.resolve("prompt", "github__triage")).toEqual({
    serverId: "github",
    serverName: "github",
    name: "triage"
  });
  expect(catalog.resolve("tool", "create_issue")).toBeNull();
});

test("resolves a URI exactly first, then by the first matching template", async () => {
  const { catalog, start } = setup({
    alpha: { exposes: { templates: ["notes://{name}"] } },
    beta: { exposes: { resources: ["notes://todo"], templates: ["notes://{name}"] } }
  });

  await start("alpha", "beta");

  expect(catalog.resolve("resource", "notes://todo")).toEqual({
    serverId: "beta",
    serverName: "beta",
    name: "notes://todo"
  });
  expect(catalog.resolve("resource", "notes://ideas")).toEqual({
    serverId: "alpha",
    serverName: "alpha",
    name: "notes://ideas"
  });
  expect(catalog.resolve("resource", "files://ideas")).toBeNull();
});

test("gives a shared URI to the first server by name and says so once in the other's logs", async () => {
  const { catalog, notes, start } = setup({
    alpha: { exposes: { resources: ["shared://doc"] } },
    beta: { exposes: { resources: ["shared://doc"] } },
    gamma: { exposes: { tools: ["search"] } }
  });

  await start("alpha", "beta");
  await start("gamma");

  expect(catalog.resolve("resource", "shared://doc")).toMatchObject({ serverId: "alpha" });
  expect(catalog.resources()).toEqual([{ uri: "shared://doc", name: "alpha__doc" }]);
  expect(notes).toEqual([["beta", "Resource shared://doc is also provided by alpha; agents will use alpha's."]]);
});

test("skips a template it can't parse without losing the server's other resources", async () => {
  const { catalog, start } = setup({
    github: { exposes: { resources: ["repo://openmcp"], templates: ["repo://{name"] } }
  });

  await start("github");

  expect(catalog.templates()).toEqual([]);
  expect(catalog.resolve("resource", "repo://openmcp")).toMatchObject({ serverId: "github" });
});

test("announces only the kinds whose exposed lists changed", async () => {
  const exposes = { tools: ["search"], prompts: ["triage"] };
  const { changes, start, listChanged } = setup({ github: { exposes } });

  await start("github");
  expect(changes).toEqual([["tools", "prompts"]]);

  exposes.tools.push("create_issue");
  listChanged("github", "notifications/tools/list_changed");
  await vi.waitFor(() => expect(changes).toEqual([["tools", "prompts"], ["tools"]]));

  listChanged("github", "notifications/prompts/list_changed");
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(changes).toHaveLength(2);
});

test("drops a server's entries when it stops", async () => {
  const { catalog, changes, start, stop } = setup({ github: { exposes: { tools: ["search"] } } });
  await start("github");

  await stop("github");

  expect(catalog.tools()).toEqual([]);
  expect(catalog.resolve("tool", "github__search")).toBeNull();
  expect(changes.at(-1)).toEqual(["tools"]);
});

test("ignores a listing that finishes after its server stopped", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  const { catalog, changes, stop } = setup({ github: { exposes: { tools: ["search"] }, gate } });

  const listing = catalog.sync(state("github", "running"));
  await stop("github");
  release();
  await listing;

  expect(catalog.tools()).toEqual([]);
  expect(changes).toEqual([]);
});

test("reports a server it can't list in that server's logs and exposes nothing from it", async () => {
  const { catalog, notes, start } = setup({
    github: { exposes: { tools: ["search"] }, fail: new Error("tools/list exploded") }
  });

  await start("github");

  expect(catalog.tools()).toEqual([]);
  expect(notes).toEqual([["github", "Couldn't list what this server exposes: tools/list exploded"]]);
});

test("treats a server without resource templates as having none", async () => {
  const { catalog, notes, start } = setup({
    github: { exposes: { resources: ["repo://openmcp"] }, noTemplates: true }
  });

  await start("github");

  expect(catalog.resources()).toHaveLength(1);
  expect(notes).toEqual([]);
});
