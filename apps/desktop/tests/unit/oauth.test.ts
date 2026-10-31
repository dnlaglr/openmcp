import type { OAuthDiscoveryState } from "@modelcontextprotocol/client";
import { beforeEach, expect, test, vi } from "vitest";
import { randomUUID } from "node:crypto";

const keyring = vi.hoisted(() => new Map<string, string>());
const auth = vi.hoisted(() => vi.fn());

vi.mock("@openmcp/secrets", () => ({
  setSecret: (key: string, value: string) => void keyring.set(key, value),
  getSecret: (key: string) => keyring.get(key) ?? null,
  deleteSecret: (key: string) => keyring.delete(key)
}));
vi.mock("@modelcontextprotocol/client", async (original) => ({
  ...(await original<typeof import("@modelcontextprotocol/client")>()),
  auth
}));

const { backgroundAuth, challengeOf, credentials, forget, oauthProvider, saveCredentials } =
  await import("../../src/main/servers/oauth");
const { SignInRequired } = await import("../../src/main/servers/connection");

const serverUrl = "https://mcp.example.com/mcp";
const tokens = { access_token: "at-1", refresh_token: "rt-1", token_type: "Bearer" };
const client = { client_id: "client-1", redirect_uris: ["http://127.0.0.1:5000/callback"] };
const authorizeUrl = new URL("https://as.example.com/authorize");

function unauthorized(serverId: string) {
  const response = new Response(null, {
    status: 401,
    headers: { "WWW-Authenticate": 'Bearer resource_metadata="https://mcp.example.com/prm", scope="read write"' }
  });
  const { onUnauthorized } = backgroundAuth(serverId, serverUrl);
  if (!onUnauthorized) throw new Error("Expected onUnauthorized");

  return onUnauthorized({ response, serverUrl: new URL(serverUrl), fetchFn: fetch });
}

let id: string;
beforeEach(() => {
  id = randomUUID();
  auth.mockReset();
});

test("keeps a server's credentials in one keychain entry", () => {
  saveCredentials(id, { client, tokens });

  expect(JSON.parse(keyring.get(`oauth:${id}`) ?? "")).toEqual({ client, tokens });
  expect(credentials(id).tokens?.access_token).toBe("at-1");
});

test("asks for a sign-in when there's nothing to refresh, remembering the challenge", async () => {
  await expect(unauthorized(id)).rejects.toBeInstanceOf(SignInRequired);

  expect(auth).not.toHaveBeenCalled();
  expect(challengeOf(id)).toEqual({ scope: "read write", resourceMetadataUrl: new URL("https://mcp.example.com/prm") });
});

test("shares one refresh between parallel 401s", async () => {
  saveCredentials(id, { client, tokens });
  auth.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve("AUTHORIZED"), 10)));

  await Promise.all([unauthorized(id), unauthorized(id), unauthorized(id)]);

  expect(auth).toHaveBeenCalledTimes(1);
  expect(auth.mock.calls[0][1]).toMatchObject({ serverUrl, scope: "read write" });
});

test("never registers a client in the background", () => {
  expect(() => oauthProvider(id).clientInformation()).toThrow(SignInRequired);
});

test("tells a rejected refresh token from a refresh that couldn't reach the server", async () => {
  saveCredentials(id, { client, tokens });
  const provider = oauthProvider(id);

  await expect(provider.redirectToAuthorization(authorizeUrl)).rejects.toThrow("Couldn't refresh the sign-in");

  await provider.invalidateCredentials?.("tokens");
  await expect(provider.redirectToAuthorization(authorizeUrl)).rejects.toBeInstanceOf(SignInRequired);
  expect(credentials(id).client).toEqual(client);
});

test("forgets the credentials and revokes the refresh token", async () => {
  const revoke = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
    async () => new Response(null, { status: 200 })
  );
  vi.stubGlobal("fetch", revoke);
  saveCredentials(id, { client, tokens });
  await oauthProvider(id).saveDiscoveryState?.({
    authorizationServerUrl: "https://as.example.com",
    authorizationServerMetadata: { revocation_endpoint: "https://as.example.com/revoke" }
  } as OAuthDiscoveryState);

  forget(id, serverUrl);

  expect(keyring.has(`oauth:${id}`)).toBe(false);
  expect(credentials(id)).toEqual({});
  await vi.waitFor(() => expect(revoke).toHaveBeenCalled());
  const [endpoint, init] = revoke.mock.calls[0];
  expect(String(endpoint)).toBe("https://as.example.com/revoke");
  expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
    token: "rt-1",
    token_type_hint: "refresh_token",
    client_id: "client-1"
  });
});
