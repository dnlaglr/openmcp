import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { Client } from "@modelcontextprotocol/client";
import { afterEach, expect, test, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { createSupervisor, type Supervisor } from "../../src/main/servers/supervisor";
import { createGatewayServer } from "../../src/main/gateway/server";
import { listen, type Listener } from "../../src/main/gateway/http";
import { stdioConnector } from "../../src/main/servers/connection";
import { createCatalog } from "../../src/main/gateway/catalog";

const bridge = fileURLToPath(new URL("../../src/main/bridge.ts", import.meta.url));
const fixture = fileURLToPath(new URL("./fixtures/stdioServer.mts", import.meta.url));
const token = "e2e-bridge-token";

let supervisor: Supervisor | undefined;
let listener: Listener | undefined;
const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await listener?.close();
  await supervisor?.stopAll();
  listener = supervisor = undefined;
});

async function gateway() {
  const names = new Map<string, string>();
  const servers = createSupervisor({
    connect: stdioConnector("test"),
    resolve: () => ({ command: process.execPath, args: [fixture], env: {} }),
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

  const id = randomUUID();
  names.set(id, "one");
  await servers.start(id);
  return `http://127.0.0.1:${listener.port}/mcp`;
}

async function connect(url: string, secret: string, era: "legacy" | "modern" = "legacy") {
  const client = new Client(
    { name: `${era}-claude-desktop`, version: "1.0.0" },
    { versionNegotiation: era === "modern" ? { mode: { pin: "2026-07-28" } } : undefined }
  );
  clients.push(client);

  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [bridge],
      env: { OPENMCP_URL: url, OPENMCP_TOKEN: secret },
      stderr: "pipe"
    })
  );
  return client;
}

test.each(["legacy", "modern"] as const)(
  "lists and calls the gateway's tools for a %s client over stdio",
  async (era) => {
    const client = await connect(await gateway(), token, era);

    await vi.waitFor(
      async () => expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(["one__echo", "one__add"]),
      { timeout: 5_000 }
    );
    const result = await client.callTool({ name: "one__echo", arguments: { message: "hello" } });

    expect(result.content).toEqual([{ type: "text", text: "hello" }]);
  }
);

test("answers with a readable error when the token is wrong", async () => {
  const url = await gateway();

  await expect(connect(url, "wrong")).rejects.toThrow(`OpenMCP isn't reachable at ${url}`);
});

test("answers with a readable error when OpenMCP isn't running", async () => {
  const url = await gateway();
  await listener!.close();
  listener = undefined;

  await expect(connect(url, token)).rejects.toThrow(`OpenMCP isn't reachable at ${url}`);
});
