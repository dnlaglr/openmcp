import type { Server } from "@modelcontextprotocol/server";
import { randomBytes } from "node:crypto";

import { DEFAULT_GATEWAY_PORT, gatewayUrl, type GatewayConnection, type GatewayState } from "@openmcp/contracts";
import { getSetting, setSetting, type Database } from "@openmcp/database";
import { getSecret, setSecret } from "@openmcp/secrets";

import { listen, type Listener } from "./http";
import type { ListKind } from "./catalog";

const PORT_SETTING = "gateway.port";
const TOKEN_SECRET = "gateway:token";

type GatewayOptions = { db: Database; factory: () => Server; onState: (state: GatewayState) => void };

const newToken = () => randomBytes(32).toString("base64url");

function token() {
  const existing = getSecret(TOKEN_SECRET);
  if (existing !== null) return existing;

  const created = newToken();
  setSecret(TOKEN_SECRET, created);
  return created;
}

function failure(error: unknown, port: number) {
  if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
    return `Port ${port} is in use by another app. Choose another port in Settings.`;
  }
  return error instanceof Error ? error.message : String(error);
}

export function createGateway({ db, factory, onState }: GatewayOptions) {
  let state: GatewayState = { status: "starting", port: DEFAULT_GATEWAY_PORT, error: null };
  let listener: Listener | undefined;
  let queue = Promise.resolve();

  const serially = (task: () => Promise<void>) => (queue = queue.then(task, task));

  function setState(patch: Partial<GatewayState>) {
    state = { ...state, ...patch };
    onState(state);
  }

  async function open() {
    const port = Number(getSetting(db, PORT_SETTING) ?? DEFAULT_GATEWAY_PORT);
    setState({ status: "starting", port, error: null });

    try {
      listener = await listen({ port, token: token(), factory });
      setState({ status: "running" });
    } catch (error) {
      setState({ status: "error", error: failure(error, port) });
    }
  }

  async function shut() {
    const current = listener;
    listener = undefined;
    await current?.close();
  }

  const restart = () =>
    serially(async () => {
      await shut();
      await open();
    });

  function connection(): GatewayConnection {
    return { url: gatewayUrl(state.port), token: token() };
  }

  return {
    start: () => serially(open),
    close: () => serially(shut),
    state: () => state,
    connection,
    setPort(port: number) {
      setSetting(db, PORT_SETTING, String(port));
      return restart();
    },
    async regenerateToken() {
      setSecret(TOKEN_SECRET, newToken());

      await restart();
      return connection();
    },
    notify: (kinds: ListKind[]) => listener?.notify(kinds)
  };
}

export type Gateway = ReturnType<typeof createGateway>;
