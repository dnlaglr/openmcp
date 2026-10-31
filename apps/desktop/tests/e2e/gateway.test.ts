import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterEach, expect, test, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { createSupervisor, type Supervisor } from "../../src/main/servers/supervisor";
import { connector, type Launch } from "../../src/main/servers/connection";
import { createGatewayServer } from "../../src/main/gateway/server";
import { listen, type Listener } from "../../src/main/gateway/http";
import { createCatalog } from "../../src/main/gateway/catalog";
import { serveHttpFixture } from "./fixtures/httpServer";

const fixture = fileURLToPath(new URL("./fixtures/stdioServer.mts", import.meta.url));
const stdioFixture: Launch = { type: "stdio", command: process.execPath, args: [fixture], env: {} };
const token = "e2e-gateway-token";
const ping = { jsonrpc: "2.0", id: 1, method: "ping" };

let supervisor: Supervisor | undefined;
let listener: Listener | undefined;
const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await listener?.close();
  await supervisor?.stopAll();
  listener = supervisor = undefined;
});

async function setup() {
  const names = new Map<string, string>();
  const launches = new Map<string, Launch>();
  const servers = createSupervisor({
    connect: connector("test"),
    resolve: (id) => launches.get(id) ?? stdioFixture,
    onState: (state) => void catalog.sync(state),
    onLog: () => {}
  });
  const catalog = createCatalog({
    supervisor: servers,
    nameOf: (id) => names.get(id),
    onChange: (kinds) => listener?.notify(kinds)
  });

  supervisor = servers;
  listener = await listen({
    port: 0,
    token,
    factory: createGatewayServer({ catalog, supervisor: servers, record: () => {}, version: "test" })
  });

  return {
    url: new URL(`http://127.0.0.1:${listener.port}/mcp`),
    start: (name: string, launch = stdioFixture) => {
      const id = randomUUID();
      names.set(id, name);
      launches.set(id, launch);
      return servers.start(id);
    }
  };
}

async function connect(url: URL, era: "legacy" | "modern", changes: string[][] = []) {
  const client = new Client(
    { name: `${era}-agent`, version: "1.0.0" },
    {
      versionNegotiation: era === "modern" ? { mode: { pin: "2026-07-28" } } : undefined,
      listChanged: {
        tools: { onChanged: (_error, tools) => void (tools && changes.push(tools.map((tool) => tool.name))) }
      }
    }
  );

  await client.connect(
    new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${token}` } } })
  );
  clients.push(client);
  return client;
}

const post = (url: URL, headers: Record<string, string>) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify(ping)
  });

test("turns away requests without the right token", async () => {
  const { url } = await setup();

  expect((await post(url, {})).status).toBe(401);
  expect((await post(url, { authorization: "Bearer wrong" })).status).toBe(401);
});

test("turns away requests from web pages", async () => {
  const { url } = await setup();

  expect((await post(url, { authorization: `Bearer ${token}`, origin: "https://evil.example" })).status).toBe(403);
});

test.each(["legacy", "modern"] as const)("lists and calls a running server's tools for a %s agent", async (era) => {
  const { url, start } = await setup();
  await start("one");
  const client = await connect(url, era);

  await vi.waitFor(
    async () => expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(["one__echo", "one__add"]),
    { timeout: 5_000 }
  );
  const result = await client.callTool({ name: "one__echo", arguments: { message: "hello" } });

  expect(result.content).toEqual([{ type: "text", text: "hello" }]);
});

test("tells agents of both eras when another server starts", async () => {
  const { url, start } = await setup();
  await start("one");
  const legacy: string[][] = [];
  const modern: string[][] = [];
  await connect(url, "legacy", legacy);
  await connect(url, "modern", modern);

  await start("two");

  for (const changes of [legacy, modern]) {
    await vi.waitFor(() => expect(changes.at(-1)).toEqual(["one__echo", "one__add", "two__echo", "two__add"]), {
      timeout: 5_000
    });
  }
});

test("closes promptly while agents are still connected", async () => {
  const { url, start } = await setup();
  await start("one");
  await connect(url, "legacy");
  await connect(url, "modern");

  await expect(listener!.close()).resolves.toBeUndefined();
  listener = undefined;
});

test("serves a remote server's tools to agents like a local server's", async () => {
  const remote = await serveHttpFixture("e2e-remote-token");

  try {
    const { url, start } = await setup();
    await start("remote", { type: "http", url: remote.url, headers: { Authorization: "Bearer e2e-remote-token" } });
    const agent = await connect(url, "legacy");

    await vi.waitFor(async () =>
      expect((await agent.listTools()).tools.map((tool) => tool.name)).toEqual(["remote__remote_echo"])
    );
    expect(await agent.callTool({ name: "remote__remote_echo", arguments: {} })).toMatchObject({
      content: [{ type: "text", text: "pong" }]
    });
  } finally {
    await remote.stop();
  }
});
