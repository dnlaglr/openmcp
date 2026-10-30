import { Client, InMemoryTransport, type CallToolResult, type RequestOptions } from "@modelcontextprotocol/client";
import { expect, test, vi } from "vitest";

import type { NewActivity } from "@openmcp/database";

import { createGatewayServer } from "../../src/main/gateway/server";
import type { Target } from "../../src/main/gateway/catalog";

type CallTool = (
  params: { name: string; arguments?: Record<string, unknown> },
  options: RequestOptions
) => Promise<CallToolResult>;

const github: Target = { serverId: "4f8b6a3e-9c1d-4e2f-8a7b-1c2d3e4f5a6b", serverName: "github", name: "create_issue" };

function setup(options: { callTool?: CallTool; record?: (row: NewActivity) => void } = {}) {
  const upstream = {
    callTool: vi.fn<CallTool>(options.callTool ?? (async () => ({ content: [{ type: "text", text: "created" }] }))),
    readResource: vi.fn(async ({ uri }: { uri: string }) => ({ contents: [{ uri, text: "readme" }] }))
  };
  const targets: Record<string, Target> = {
    "tool:github__create_issue": github,
    "resource:repo://openmcp": { ...github, name: "repo://openmcp" }
  };
  const activity: NewActivity[] = [];

  const factory = createGatewayServer({
    catalog: {
      tools: () => [{ name: "github__create_issue", inputSchema: { type: "object" } }],
      prompts: () => [],
      resources: () => [],
      templates: () => [],
      resolve: (kind, name) => targets[`${kind}:${name}`] ?? null
    },
    supervisor: { client: (id) => (id === github.serverId ? (upstream as unknown as Client) : undefined) },
    record: options.record ?? ((row) => activity.push(row)),
    version: "test"
  });

  async function connect() {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-agent", version: "1.0.0" });

    await factory().connect(serverTransport);
    await client.connect(clientTransport);
    return client;
  }

  return { upstream, activity, connect };
}

test("lists what the catalog exposes", async () => {
  const client = await setup().connect();

  const { tools } = await client.listTools();

  expect(tools.map((tool) => tool.name)).toEqual(["github__create_issue"]);
});

test("calls the owning server by the tool's original name and records the call", async () => {
  const { upstream, activity, connect } = setup();
  const client = await connect();

  const result = await client.callTool({ name: "github__create_issue", arguments: { title: "Bug" } });

  expect(result.content).toEqual([{ type: "text", text: "created" }]);
  expect(upstream.callTool).toHaveBeenCalledWith(
    { name: "create_issue", arguments: { title: "Bug" } },
    expect.anything()
  );
  expect(activity).toEqual([
    {
      at: expect.any(Date),
      kind: "tool",
      name: "create_issue",
      serverId: github.serverId,
      serverName: "github",
      client: "test-agent",
      durationMs: expect.any(Number),
      outcome: "ok",
      error: null
    }
  ]);
});

test("answers an unknown tool with InvalidParams and records it as unavailable", async () => {
  const { activity, connect } = setup();
  const client = await connect();

  await expect(client.callTool({ name: "github__missing", arguments: {} })).rejects.toMatchObject({
    code: -32602,
    message: expect.stringContaining("Unknown tool github__missing")
  });
  expect(activity[0]).toMatchObject({
    name: "github__missing",
    serverId: null,
    serverName: null,
    outcome: "unavailable"
  });
});

test("passes a tool's own error result through and records it as a tool error", async () => {
  const { activity, connect } = setup({
    callTool: async () => ({ content: [{ type: "text", text: "rate limited" }], isError: true })
  });
  const client = await connect();

  const result = await client.callTool({ name: "github__create_issue", arguments: {} });

  expect(result.isError).toBe(true);
  expect(activity[0]).toMatchObject({ outcome: "tool_error", error: null });
});

test("reports an upstream failure as an error with its message", async () => {
  const { activity, connect } = setup({
    callTool: async () => {
      throw new Error("Process exited");
    }
  });
  const client = await connect();

  await expect(client.callTool({ name: "github__create_issue", arguments: {} })).rejects.toMatchObject({
    message: expect.stringContaining("Process exited")
  });
  expect(activity[0]).toMatchObject({ outcome: "error", error: "Process exited" });
});

test("reads a resource from the server that owns its URI", async () => {
  const { upstream, activity, connect } = setup();
  const client = await connect();

  const { contents } = await client.readResource({ uri: "repo://openmcp" });

  expect(contents).toEqual([{ uri: "repo://openmcp", text: "readme" }]);
  expect(upstream.readResource).toHaveBeenCalledWith({ uri: "repo://openmcp" }, expect.anything());
  expect(activity[0]).toMatchObject({ kind: "resource", name: "repo://openmcp", outcome: "ok" });
});

test("forwards cancellation, progress and a 10-minute timeout to the upstream call", async () => {
  const { upstream, connect } = setup({
    callTool: async (_params, options) => {
      options.onprogress?.({ progress: 1, total: 2 });
      return { content: [] };
    }
  });
  const client = await connect();
  const progress: unknown[] = [];

  await client.callTool(
    { name: "github__create_issue", arguments: {} },
    { onprogress: (update) => progress.push(update) }
  );

  expect(progress).toEqual([{ progress: 1, total: 2 }]);
  expect(upstream.callTool.mock.calls[0][1]).toMatchObject({
    timeout: 600_000,
    resetTimeoutOnProgress: true,
    signal: expect.any(AbortSignal)
  });
});

test("still answers when the activity can't be recorded", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { connect } = setup({
    record: () => {
      throw new Error("database is locked");
    }
  });
  const client = await connect();

  await expect(client.callTool({ name: "github__create_issue", arguments: {} })).resolves.toMatchObject({
    content: [{ type: "text", text: "created" }]
  });
});
