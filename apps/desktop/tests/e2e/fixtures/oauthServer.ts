import { createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createServer, type Server } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";

import { fixtureServer } from "./httpServer";

export type OAuthFixture = {
  url: string;
  // Every token handed out, so tests can check none leak into the database.
  issued: string[];
  revoked: string[];
  registrations: () => number;
  refreshes: () => number;
  expireAccessTokens: () => void;
  rejectRefresh: (reject: boolean) => void;
  deny: (deny: boolean) => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

const json = (body: unknown, status = 200) => Response.json(body, { status });

// An authorization server and the MCP server it protects on one 127.0.0.1 port. It approves every request at once.
export async function serveOAuthFixture(): Promise<OAuthFixture> {
  const mcp = createMcpHandler(fixtureServer);
  const clients = new Map<string, string[]>();
  const codes = new Map<string, { challenge: string; redirectUri: string }>();
  const accessTokens = new Set<string>();
  const refreshTokens = new Set<string>();
  const issued: string[] = [];
  const revoked: string[] = [];
  let registrations = 0;
  let refreshes = 0;
  let rejectingRefresh = false;
  let denying = false;
  let origin = "";
  let port = 0;
  let http: Server | undefined;

  function grant() {
    const access = `at-${randomUUID()}`;
    const refresh = `rt-${randomUUID()}`;
    accessTokens.add(access);
    refreshTokens.add(refresh);
    issued.push(access, refresh);
    return json({ access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: 3600 });
  }

  async function token(request: Request) {
    const form = new URLSearchParams(await request.text());

    if (form.get("grant_type") === "refresh_token") {
      if (rejectingRefresh || !refreshTokens.delete(form.get("refresh_token") ?? "")) {
        return json({ error: "invalid_grant" }, 400);
      }
      refreshes++;
      return grant();
    }

    const code = codes.get(form.get("code") ?? "");
    codes.delete(form.get("code") ?? "");
    const challenge = createHash("sha256")
      .update(form.get("code_verifier") ?? "")
      .digest("base64url");
    if (!code || code.challenge !== challenge || code.redirectUri !== form.get("redirect_uri")) {
      return json({ error: "invalid_grant" }, 400);
    }
    return grant();
  }

  function authorize(params: URLSearchParams) {
    const redirectUri = params.get("redirect_uri") ?? "";
    if (!clients.get(params.get("client_id") ?? "")?.includes(redirectUri)) {
      return new Response("Unregistered redirect_uri", { status: 400 });
    }

    const callback = new URL(redirectUri);
    callback.searchParams.set("state", params.get("state") ?? "");
    callback.searchParams.set("iss", origin);
    if (denying) {
      callback.searchParams.set("error", "access_denied");
    } else {
      const code = randomUUID();
      codes.set(code, { challenge: params.get("code_challenge") ?? "", redirectUri });
      callback.searchParams.set("code", code);
    }
    return Response.redirect(callback, 302);
  }

  async function fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      const bearer = request.headers.get("authorization")?.replace(/^Bearer /, "");
      if (bearer && accessTokens.has(bearer)) return mcp.fetch(request);

      const challenge = `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", scope="mcp"`;
      return new Response(null, { status: 401, headers: { "WWW-Authenticate": challenge } });
    }

    switch (`${request.method} ${url.pathname}`) {
      case "GET /.well-known/oauth-protected-resource/mcp":
        return json({ resource: `${origin}/mcp`, authorization_servers: [origin], scopes_supported: ["mcp"] });
      case "GET /.well-known/oauth-authorization-server":
        return json({
          issuer: origin,
          authorization_endpoint: `${origin}/authorize`,
          token_endpoint: `${origin}/token`,
          registration_endpoint: `${origin}/register`,
          revocation_endpoint: `${origin}/revoke`,
          response_types_supported: ["code"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["none"],
          authorization_response_iss_parameter_supported: true
        });
      case "POST /register": {
        const metadata = (await request.json()) as { redirect_uris: string[] };
        const clientId = `client-${++registrations}`;
        clients.set(clientId, metadata.redirect_uris);
        return json({ ...metadata, client_id: clientId }, 201);
      }
      case "GET /authorize":
        return authorize(url.searchParams);
      case "POST /token":
        return token(request);
      case "POST /revoke":
        revoked.push(new URLSearchParams(await request.text()).get("token") ?? "");
        return new Response(null, { status: 200 });
      default:
        return new Response(null, { status: 404 });
    }
  }

  async function start() {
    const server = createServer(toNodeHandler({ fetch }));
    await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
    origin = `http://127.0.0.1:${port}`;
    http = server;
  }

  async function stop() {
    const server = http;
    http = undefined;
    server?.closeAllConnections();
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  }

  await start();
  return {
    url: `${origin}/mcp`,
    issued,
    revoked,
    registrations: () => registrations,
    refreshes: () => refreshes,
    expireAccessTokens: () => accessTokens.clear(),
    rejectRefresh: (reject) => void (rejectingRefresh = reject),
    deny: (deny) => void (denying = deny),
    start,
    stop
  };
}
