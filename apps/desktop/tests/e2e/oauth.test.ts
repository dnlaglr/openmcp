import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";

import type { ServerState } from "@openmcp/contracts";

import { createSupervisor, type Supervisor } from "../../src/main/servers/supervisor";
import { backgroundAuth, credentials, forget } from "../../src/main/servers/oauth";
import { serveOAuthFixture, type OAuthFixture } from "./fixtures/oauthServer";
import { connector, describeServer } from "../../src/main/servers/connection";
import { createSignIn } from "../../src/main/servers/signIn";
import { serveHttpFixture } from "./fixtures/httpServer";

// Stands in for the browser: follows /authorize's redirect to OpenMCP's loopback callback.
const browser = async (url: string) => void (await fetch(url));

let fixture: OAuthFixture;
let supervisor: Supervisor;
let id: string;
let states: ServerState[];

beforeEach(async () => {
  fixture = await serveOAuthFixture();
  id = randomUUID();
  states = [];
});

afterEach(async () => {
  await supervisor.stopAll();
  forget(id, fixture.url);
  await fixture.stop();
});

function setup({ url = fixture.url, openUrl = browser, timeoutMs = 2_000 } = {}) {
  supervisor = createSupervisor({
    connect: connector("test", { pingEveryMs: 100 }),
    resolve: () => ({ type: "http", url, headers: {}, auth: backgroundAuth(id, url) }),
    onState: (state) => states.push(state),
    onLog: () => {},
    restartDelays: [0],
    retryEveryMs: 50
  });
  return createSignIn({ urlOf: () => url, supervisor, openUrl, onChange: () => {}, timeoutMs });
}

const last = () => states.at(-1);
const running = () => vi.waitFor(() => expect(last()?.status).toBe("running"), { timeout: 5_000 });

test("signs in through the browser, then connects with the token", async () => {
  const { signIn } = setup();
  await supervisor.start(id);
  expect(last()?.status).toBe("signin");

  await signIn(id);
  await running();

  expect(fixture.registrations()).toBe(1);
  const client = supervisor.client(id);
  if (!client) throw new Error("Expected a client");
  expect((await describeServer(client)).tools?.map((tool) => tool.name)).toEqual(["remote_echo"]);
});

test("refreshes an expired token once for parallel requests, without the browser", async () => {
  const { signIn } = setup();
  await supervisor.start(id);
  await signIn(id);
  await running();

  fixture.expireAccessTokens();
  const client = supervisor.client(id);
  if (!client) throw new Error("Expected a client");
  await Promise.all([client.listTools(), client.listTools(), client.listTools()]);

  expect(fixture.refreshes()).toBe(1);
  expect(last()?.status).toBe("running");
});

test("waits for a sign-in when the refresh token is rejected, then reuses its registration and port", async () => {
  const { signIn } = setup();
  await supervisor.start(id);
  await signIn(id);
  await running();
  const { redirectUrl } = credentials(id);

  fixture.expireAccessTokens();
  fixture.rejectRefresh(true);
  await vi.waitFor(() => expect(last()?.status).toBe("signin"), { timeout: 5_000 });

  fixture.rejectRefresh(false);
  await signIn(id);
  await running();
  expect(fixture.registrations()).toBe(1);
  expect(credentials(id).redirectUrl).toBe(redirectUrl);
});

test("registers again when its port is taken", async () => {
  const { signIn } = setup();
  await supervisor.start(id);
  await signIn(id);
  await running();

  const blocker = createServer();
  await new Promise<void>((resolve) =>
    blocker.listen(Number(new URL(credentials(id).redirectUrl ?? "").port), "127.0.0.1", resolve)
  );
  try {
    await supervisor.requireSignIn(id);
    await signIn(id);
    await running();
  } finally {
    blocker.close();
  }

  expect(fixture.registrations()).toBe(2);
});

test("keeps the sign-in through an outage and reconnects without the browser", async () => {
  const { signIn } = setup();
  await supervisor.start(id);
  await signIn(id);
  await running();

  await fixture.stop();
  await vi.waitFor(() => expect(last()?.status).toBe("starting"), { timeout: 5_000 });
  fixture.expireAccessTokens();
  await fixture.start();

  await running();
  expect(fixture.refreshes()).toBe(1);
  expect(fixture.registrations()).toBe(1);
});

test("reports a sign-in denied in the browser", async () => {
  const { signIn } = setup();
  await supervisor.start(id);
  fixture.deny(true);

  await expect(signIn(id)).rejects.toThrow("Sign-in was denied or cancelled in the browser.");
  expect(last()).toMatchObject({ status: "signin", error: "Sign-in was denied or cancelled in the browser." });
});

test("gives up on a sign-in the browser never finishes", async () => {
  const { signIn } = setup({ openUrl: async () => {}, timeoutMs: 200 });
  await supervisor.start(id);

  await expect(signIn(id)).rejects.toThrow("Sign-in timed out. Try again.");
});

test("stops a waiting sign-in when the server is removed, saving nothing", async () => {
  const { signIn, cancel } = setup({ openUrl: async () => {} });
  await supervisor.start(id);

  const pending = signIn(id);
  await vi.waitFor(() => expect(fixture.registrations()).toBe(1));
  await cancel(id);

  await expect(pending).rejects.toThrow("The server was removed.");
  expect(credentials(id).tokens).toBeUndefined();
});

test("signs out by revoking the refresh token and waiting for a sign-in", async () => {
  const { signIn, signOut } = setup();
  await supervisor.start(id);
  await signIn(id);
  await running();

  await signOut(id);

  expect(last()?.status).toBe("signin");
  expect(credentials(id)).toEqual({});
  await vi.waitFor(() => expect(fixture.revoked).toHaveLength(1));
  expect(fixture.issued).toContain(fixture.revoked[0]);
});

test("explains that a server without OAuth can't be signed into", async () => {
  const plain = await serveHttpFixture("some-key");
  try {
    const { signIn } = setup({ url: plain.url });
    await supervisor.start(id);
    expect(last()?.status).toBe("signin");

    await expect(signIn(id)).rejects.toThrow(
      "This server doesn't support OAuth sign-in. If it takes an API key, check the server's headers."
    );
  } finally {
    await plain.stop();
  }
});
