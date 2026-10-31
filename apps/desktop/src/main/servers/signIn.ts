import { auth, RegistrationRejectedError } from "@modelcontextprotocol/client";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomBytes } from "node:crypto";

import {
  challengeOf,
  credentials,
  discoveryOf,
  forget,
  isSecureUrl,
  oauthFetch,
  oauthProvider,
  saveCredentials
} from "./oauth";
import type { Supervisor } from "./supervisor";

const SIGN_IN_TIMEOUT_MS = 5 * 60_000;
const CALLBACK_PAGE =
  '<!doctype html><meta charset="utf-8"><title>OpenMCP</title><p>You can close this tab and return to OpenMCP.</p>';

// A sign-in failure whose message is already written for the user.
class SignInError extends Error {}

type SignInOptions = {
  urlOf: (id: string) => string | undefined;
  supervisor: Supervisor;
  openUrl: (url: string) => Promise<void>;
  onChange: () => void;
  timeoutMs?: number;
};

const bind = (server: Server, port: number) =>
  new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

// Reuses the port this server's client was registered with, since some providers match the redirect exactly.
async function listen(stored?: string) {
  const server = createServer();
  await bind(server, stored ? Number(new URL(stored).port) : 0).catch(() => bind(server, 0));
  const { port } = server.address() as AddressInfo;

  return {
    redirectUrl: `http://127.0.0.1:${port}/callback`,
    callback: (state: string, signal: AbortSignal) =>
      new Promise<URLSearchParams>((resolve, reject) => {
        signal.addEventListener(
          "abort",
          () =>
            reject(
              signal.reason instanceof SignInError ? signal.reason : new SignInError("Sign-in timed out. Try again.")
            ),
          { once: true }
        );
        server.on("request", (request, response) => {
          const url = new URL(request.url ?? "/", "http://127.0.0.1");
          if (request.method !== "GET" || url.pathname !== "/callback" || url.searchParams.get("state") !== state) {
            response.writeHead(404).end();
            return;
          }

          response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(CALLBACK_PAGE);
          resolve(url.searchParams);
        });
      }),
    close: () => {
      server.closeAllConnections();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    }
  };
}

function signInMessage(id: string, error: unknown) {
  if (error instanceof SignInError) return error.message;

  const discovery = discoveryOf(id);
  if (discovery && !discovery.authorizationServerMetadata) {
    return "This server doesn't support OAuth sign-in. If it takes an API key, check the server's headers.";
  }

  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof RegistrationRejectedError || message.includes("does not support dynamic client registration")) {
    return "This server doesn't let apps register for sign-in, so OpenMCP can't sign in to it yet.";
  }
  return `Sign-in failed: ${message}`;
}

export function createSignIn({ urlOf, supervisor, openUrl, onChange, timeoutMs = SIGN_IN_TIMEOUT_MS }: SignInOptions) {
  const flows = new Map<string, { abort: AbortController; done: Promise<void> }>();

  async function authorize(id: string, serverUrl: string, signal: AbortSignal) {
    const stored = credentials(id).redirectUrl;
    const listener = await listen(stored);
    if (stored && listener.redirectUrl !== stored) saveCredentials(id, { client: undefined, tokens: undefined });

    try {
      const state = randomBytes(16).toString("base64url");
      // Listening before auth() starts, since the browser can come back before auth() returns.
      const callback = listener.callback(state, AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]));
      callback.catch(() => {});

      const provider = oauthProvider(id, {
        redirectUrl: listener.redirectUrl,
        state,
        open: async (url) => {
          if (!isSecureUrl(url))
            throw new SignInError("The sign-in page isn't served over HTTPS, so OpenMCP won't open it.");

          supervisor.note(id, "Opened your browser to sign in.");
          await openUrl(url.href);
        }
      });

      // Always the browser: a server that rejects refreshed tokens would otherwise loop through silent refreshes.
      await auth(provider, { serverUrl, ...challengeOf(id), fetchFn: oauthFetch, forceReauthorization: true });

      const params = await callback;
      const code = params.get("code");
      if (params.has("error") || !code) throw new SignInError("Sign-in was denied or cancelled in the browser.");

      await auth(provider, {
        serverUrl,
        authorizationCode: code,
        iss: params.get("iss") ?? undefined,
        fetchFn: oauthFetch
      });
    } finally {
      await listener.close();
    }
  }

  async function run(id: string, serverUrl: string, signal: AbortSignal) {
    try {
      await authorize(id, serverUrl, signal);
    } catch (error) {
      // A replaced, signed-out or removed flow leaves the server's state to whoever stopped it.
      if (signal.aborted) throw signal.reason;

      const message = signInMessage(id, error);
      await supervisor.requireSignIn(id, message);
      throw new Error(message, { cause: error });
    }

    supervisor.note(id, "Signed in.");
    onChange();
    await supervisor.restartIfActive(id);
    await supervisor.start(id);
  }

  async function cancel(id: string, reason = "The server was removed.") {
    const flow = flows.get(id);
    flow?.abort.abort(new SignInError(reason));
    await flow?.done.catch(() => {});
  }

  async function signIn(id: string) {
    const serverUrl = urlOf(id);
    if (!serverUrl) throw new Error("Only remote servers can sign in.");

    await cancel(id, "Replaced by a new sign-in.");
    const abort = new AbortController();
    const done = run(id, serverUrl, abort.signal);
    flows.set(id, { abort, done });

    try {
      await done;
    } finally {
      if (flows.get(id)?.abort === abort) flows.delete(id);
    }
  }

  async function signOut(id: string) {
    const serverUrl = urlOf(id);
    if (!serverUrl) return;

    await cancel(id, "Signed out.");
    forget(id, serverUrl, () =>
      supervisor.note(id, "Couldn't revoke the sign-in at the provider; signed out locally.")
    );
    await supervisor.requireSignIn(id);
    supervisor.note(id, "Signed out.");
    onChange();
  }

  // Right after an install or add, the user is expecting the browser, so the sign-in starts on its own.
  function signInIfNeeded(id: string) {
    if (supervisor.states().some((state) => state.id === id && state.status === "signin")) {
      void signIn(id).catch(() => {});
    }
  }

  return { signIn, signOut, cancel: (id: string) => cancel(id), signInIfNeeded };
}

export type SignIn = ReturnType<typeof createSignIn>;
