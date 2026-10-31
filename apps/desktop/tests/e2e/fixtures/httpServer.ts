import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export type HttpFixture = {
  url: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  // Answers every request with this status until it's set back to null.
  failWith: (status: number | null) => void;
};

export function fixtureServer() {
  const server = new McpServer({ name: "http-fixture", version: "1.0.0" });
  server.registerTool("remote_echo", { description: "Answers pong over HTTP." }, () => ({
    content: [{ type: "text" as const, text: "pong" }]
  }));
  return server;
}

// A Streamable HTTP server on 127.0.0.1 that wants `Authorization: Bearer <token>` and can go away and come back.
export async function serveHttpFixture(token: string): Promise<HttpFixture> {
  const mcp = createMcpHandler(fixtureServer);
  let failure: number | null = null;
  let port = 0;
  let http: Server | undefined;

  async function fetch(request: Request) {
    if (failure !== null) return new Response(null, { status: failure });
    if (new URL(request.url).pathname !== "/mcp") return new Response(null, { status: 404 });
    if (request.headers.get("authorization") !== `Bearer ${token}`) return new Response(null, { status: 401 });

    return mcp.fetch(request);
  }

  async function start() {
    const server = createServer(toNodeHandler({ fetch }));
    await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
    http = server;
  }

  async function stop() {
    const server = http;
    http = undefined;
    server?.closeAllConnections();
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  }

  await start();
  return { url: `http://127.0.0.1:${port}/mcp`, start, stop, failWith: (status) => void (failure = status) };
}
