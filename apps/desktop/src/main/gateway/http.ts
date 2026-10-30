import {
  createMcpHandler,
  hostHeaderValidationResponse,
  isLegacyRequest,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  originValidationResponse,
  WebStandardStreamableHTTPServerTransport,
  type Server
} from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { AddressInfo } from "node:net";
import { createServer } from "node:http";

import type { ListKind } from "./catalog";

const MAX_SESSIONS = 100;

type Session = { transport: WebStandardStreamableHTTPServerTransport; server: Server };
type ListenOptions = { port: number; token: string; factory: () => Server };

export type Listener = Awaited<ReturnType<typeof listen>>;

const announce: Record<ListKind, (server: Server) => Promise<void>> = {
  tools: (server) => server.sendToolListChanged(),
  prompts: (server) => server.sendPromptListChanged(),
  resources: (server) => server.sendResourceListChanged()
};

const jsonRpcError = (status: number, message: string) =>
  Response.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message } }, { status });

function authorized(header: string | null, token: string) {
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function listen({ port, token, factory }: ListenOptions) {
  const modern = createMcpHandler(factory, { legacy: "reject" });
  const sessions = new Map<string, Session>();

  function remember(id: string, session: Session) {
    const [oldest] = sessions.keys();
    if (sessions.size >= MAX_SESSIONS && oldest !== undefined) {
      void sessions.get(oldest)?.transport.close();
      sessions.delete(oldest);
    }

    sessions.set(id, session);
  }

  async function legacy(request: Request) {
    const id = request.headers.get("mcp-session-id");
    if (id) return sessions.get(id)?.transport.handleRequest(request) ?? jsonRpcError(404, "Session not found");

    const server = factory();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      onsessioninitialized: (sessionId) => remember(sessionId, { transport, server }),
      onsessionclosed: (sessionId) => void sessions.delete(sessionId)
    });

    await server.connect(transport);
    return transport.handleRequest(request);
  }

  async function fetch(request: Request) {
    if (new URL(request.url).pathname !== "/mcp") return new Response(null, { status: 404 });

    const rejected =
      hostHeaderValidationResponse(request, localhostAllowedHostnames()) ??
      originValidationResponse(request, localhostAllowedOrigins());
    if (rejected) return rejected;
    if (!authorized(request.headers.get("authorization"), token)) {
      return jsonRpcError(401, "Missing or wrong gateway token");
    }

    return (await isLegacyRequest(request)) ? legacy(request) : modern.fetch(request);
  }

  const http = createServer(toNodeHandler({ fetch }));
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(port, "127.0.0.1", () => {
      http.off("error", reject);
      resolve();
    });
  });

  return {
    port: (http.address() as AddressInfo).port,
    notify(kinds: ListKind[]) {
      for (const kind of kinds) {
        if (kind === "tools") modern.notify.toolsChanged();
        if (kind === "prompts") modern.notify.promptsChanged();
        if (kind === "resources") modern.notify.resourcesChanged();

        for (const { server } of sessions.values()) void announce[kind](server).catch(() => {});
      }
    },
    async close() {
      await modern.close();
      await Promise.all([...sessions.values()].map(({ transport }) => transport.close()));
      sessions.clear();

      http.closeAllConnections();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    }
  };
}
