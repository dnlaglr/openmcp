import {
  auth,
  discoverOAuthServerInfo,
  extractWWWAuthenticateParams,
  type FetchLike,
  type OAuthClientProvider,
  type OAuthDiscoveryState,
  type StoredOAuthClientInformation,
  type StoredOAuthTokens
} from "@modelcontextprotocol/client";

import { deleteSecret, getSecret, setSecret } from "@openmcp/secrets";

import { SignInRequired, type LaunchAuth } from "./connection";

export type Credentials = { redirectUrl?: string; client?: StoredOAuthClientInformation; tokens?: StoredOAuthTokens };
export type Flow = { redirectUrl: string; state: string; open: (url: URL) => Promise<void> };
type Challenge = { scope?: string; resourceMetadataUrl?: URL };

const REQUEST_TIMEOUT_MS = 15_000;
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
// The SDK only takes the browser path when a redirect URL exists; a background provider never reaches the browser.
const PLACEHOLDER_REDIRECT = "http://127.0.0.1/callback";

// token() runs before every request, so the keychain is read once per server and written through.
const cache = new Map<string, Credentials>();
const discoveries = new Map<string, OAuthDiscoveryState>();
const challenges = new Map<string, Challenge>();
const refreshes = new Map<string, Promise<unknown>>();
// The Authorization header each response answered, so a 401 that left before a refresh doesn't start another one.
const sentWith = new WeakMap<Response, string | null>();

const secretKey = (serverId: string) => `oauth:${serverId}`;

export function credentials(serverId: string): Credentials {
  let stored = cache.get(serverId);
  if (!stored) {
    const json = getSecret(secretKey(serverId));
    stored = json === null ? {} : (JSON.parse(json) as Credentials);
    cache.set(serverId, stored);
  }

  return stored;
}

export function saveCredentials(serverId: string, patch: Credentials) {
  const next = { ...credentials(serverId), ...patch };
  setSecret(secretKey(serverId), JSON.stringify(next));
  cache.set(serverId, next);
}

function clearCredentials(serverId: string) {
  deleteSecret(secretKey(serverId));
  cache.set(serverId, {});
  discoveries.delete(serverId);
  challenges.delete(serverId);
}

export const hasTokens = (serverId: string) => credentials(serverId).tokens !== undefined;
export const discoveryOf = (serverId: string) => discoveries.get(serverId);
export const challengeOf = (serverId: string): Challenge => challenges.get(serverId) ?? {};

export const isSecureUrl = (url: URL) =>
  url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK.has(url.hostname));

// Never the transport's fetchFn: it carries the launch's headers, which belong to the MCP server, not its sign-in.
export const oauthFetch: FetchLike = (url, init) => {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return fetch(url, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
};

export function oauthProvider(serverId: string, flow?: Flow): OAuthClientProvider {
  let verifier = "";
  const redirectUrl = () => flow?.redirectUrl ?? credentials(serverId).redirectUrl ?? PLACEHOLDER_REDIRECT;

  return {
    get redirectUrl() {
      return redirectUrl();
    },
    get clientMetadata() {
      return {
        client_name: "OpenMCP",
        client_uri: "https://github.com/dnlaglr/openmcp",
        redirect_uris: [redirectUrl()],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none"
      };
    },
    ...(flow && { state: () => flow.state }),
    clientInformation: () => {
      const { client } = credentials(serverId);
      // Registering is part of signing in, never of a background refresh.
      if (!client && !flow) throw new SignInRequired();
      return client;
    },
    saveClientInformation: (client) =>
      saveCredentials(serverId, flow ? { client, redirectUrl: flow.redirectUrl } : { client }),
    tokens: () => credentials(serverId).tokens,
    saveTokens: (tokens) => saveCredentials(serverId, { tokens }),
    redirectToAuthorization: async (url) => {
      if (flow) return flow.open(url);

      // The SDK lands here after dropping a rejected refresh token, and also when a refresh couldn't reach the server.
      throw credentials(serverId).tokens ? new Error("Couldn't refresh the sign-in") : new SignInRequired();
    },
    saveCodeVerifier: (codeVerifier) => void (verifier = codeVerifier),
    codeVerifier: () => verifier,
    saveDiscoveryState: (state) => void discoveries.set(serverId, state),
    discoveryState: () => discoveries.get(serverId),
    invalidateCredentials: (scope) => {
      if (scope === "all") clearCredentials(serverId);
      if (scope === "client") saveCredentials(serverId, { client: undefined });
      if (scope === "tokens") saveCredentials(serverId, { tokens: undefined });
      if (scope === "discovery") discoveries.delete(serverId);
    }
  };
}

export function backgroundAuth(serverId: string, serverUrl: string): LaunchAuth {
  return {
    token: async () => credentials(serverId).tokens?.access_token,
    fetch: async (url, init) => {
      const response = await fetch(url, init);
      sentWith.set(response, new Headers(init?.headers).get("authorization"));
      return response;
    },
    onUnauthorized: async ({ response }) => {
      const { scope, resourceMetadataUrl } = extractWWWAuthenticateParams(response);
      challenges.set(serverId, { scope, resourceMetadataUrl });

      const { tokens } = credentials(serverId);
      // The token was replaced while this request was out, so the transport's retry with the new one is enough.
      if (tokens && sentWith.has(response) && sentWith.get(response) !== `Bearer ${tokens.access_token}`) return;
      if (!tokens?.refresh_token) throw new SignInRequired();

      // Parallel requests share one refresh, since a rotating server accepts each refresh token only once.
      let refresh = refreshes.get(serverId);
      if (!refresh) {
        refresh = auth(oauthProvider(serverId), { serverUrl, scope, resourceMetadataUrl, fetchFn: oauthFetch }).finally(
          () => refreshes.delete(serverId)
        );
        refreshes.set(serverId, refresh);
      }
      await refresh;
    }
  };
}

async function revoke(serverUrl: string, stored: Credentials, discovery?: OAuthDiscoveryState) {
  const { client, tokens } = stored;
  if (!client || !tokens) return;

  const metadata =
    discovery?.authorizationServerMetadata ??
    (await discoverOAuthServerInfo(serverUrl, { fetchFn: oauthFetch })).authorizationServerMetadata;
  const endpoint = metadata && "revocation_endpoint" in metadata ? metadata.revocation_endpoint : undefined;
  if (!endpoint || !isSecureUrl(new URL(endpoint))) return;

  const [token, hint] = tokens.refresh_token
    ? [tokens.refresh_token, "refresh_token"]
    : [tokens.access_token, "access_token"];
  const body = new URLSearchParams({ token, token_type_hint: hint, client_id: client.client_id });
  if (client.client_secret) body.set("client_secret", client.client_secret);

  const response = await oauthFetch(endpoint, { method: "POST", body });
  if (!response.ok) throw new Error(`Revocation failed (HTTP ${response.status})`);
}

// Local deletion never waits on the provider; revoking is a courtesy that may fail offline.
export function forget(serverId: string, serverUrl: string, onRevokeFailed?: () => void) {
  const stored = credentials(serverId);
  const discovery = discoveries.get(serverId);
  clearCredentials(serverId);

  void revoke(serverUrl, stored, discovery).catch(() => onRevokeFailed?.());
}
