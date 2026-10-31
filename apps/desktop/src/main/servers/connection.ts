import {
  Client,
  SdkError,
  StreamableHTTPClientTransport,
  UnauthorizedError,
  type AuthProvider,
  type FetchLike
} from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";

import type { LaunchSpec, ServerDetails } from "@openmcp/contracts";

export type StdioLaunch = Omit<Extract<LaunchSpec, { type: "stdio" }>, "secretEnv">;
// The fetch lets the provider see which token each response answered.
export type LaunchAuth = AuthProvider & { fetch: FetchLike };
export type HttpLaunch = Omit<Extract<LaunchSpec, { type: "http" }>, "secretHeaders"> & { auth?: LaunchAuth };
export type Launch = StdioLaunch | HttpLaunch;

export type Connection = { client: Client; pid: number | null; close: () => Promise<void> };

type Handlers = { onLog: (text: string) => void; onExit: (reason?: string) => void };
type Connector<L extends Launch> = (launch: L, handlers: Handlers) => Promise<Connection>;
export type Connect = Connector<Launch>;

// A connect failure that retrying can't fix, like a rejected key or a wrong address.
export class FatalError extends Error {}

// A remote server that needs an OAuth sign-in nobody has done yet, or one whose sign-in can't be refreshed.
export class SignInRequired extends Error {
  constructor() {
    super("Sign in to this server in OpenMCP to use it.");
  }
}

export const hasAuthorization = (headers: Record<string, string>) =>
  Object.keys(headers).some((name) => name.toLowerCase() === "authorization");

const PING_EVERY_MS = 30_000;
const PING_TIMEOUT_MS = 10_000;

export function stdioConnector(clientVersion: string): Connector<StdioLaunch> {
  return async ({ command, args, env }, { onLog, onExit }) => {
    const transport = new StdioClientTransport({ command, args, env, stderr: "pipe" });

    let lastStderr: string | undefined;
    createInterface({ input: transport.stderr as Readable }).on("line", (line) => {
      lastStderr = line;
      onLog(line);
    });

    let spawnError: Error | undefined;
    const client = new Client({ name: "openmcp", version: clientVersion });
    client.onerror = (error) => {
      spawnError ??= error;
    };

    try {
      await client.connect(transport);
    } catch (error) {
      await transport.close().catch(() => {});

      const reason = spawnError?.message ?? lastStderr ?? (error instanceof Error ? error.message : String(error));
      throw new Error(reason, { cause: error });
    }

    client.onclose = onExit;

    return { client, pid: transport.pid, close: () => client.close() };
  };
}

function httpStatus(error: unknown) {
  if (error instanceof UnauthorizedError) return 401;

  const data = error instanceof SdkError ? error.data : undefined;
  return typeof data === "object" && data !== null && "status" in data && typeof data.status === "number"
    ? data.status
    : null;
}

function fatalMessage(status: number) {
  if (status === 401) return "The server rejected the credentials (HTTP 401). Check the headers.";
  if (status === 403) return "The server denied access (HTTP 403). Check the headers.";
  if (status === 404) return "Nothing answered at this URL (HTTP 404). Check the address.";
  if (status === 405) {
    return "The server doesn't accept Streamable HTTP (HTTP 405). It may only support the older SSE transport.";
  }
  return `The server refused the connection (HTTP ${status}).`;
}

// Only a 4xx is the server's final answer; outages, rate limits and captive portals pass.
function connectError(error: unknown, launch: HttpLaunch) {
  if (error instanceof SignInRequired) return error;

  const status = httpStatus(error);
  // Without a key of the user's own, a 401 means the server wants a sign-in (or a key nobody has added).
  if (status === 401 && !hasAuthorization(launch.headers)) return new SignInRequired();
  if (status !== null && status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return new FatalError(fatalMessage(status), { cause: error });
  }

  const reason = error instanceof Error ? error.message : String(error);
  return new Error(`Couldn't reach ${new URL(launch.url).host}: ${reason}`, { cause: error });
}

// HTTP has no process to exit, so a failed ping is how a dropped network or expired session shows up.
export function httpConnector(
  clientVersion: string,
  { pingEveryMs = PING_EVERY_MS }: { pingEveryMs?: number } = {}
): Connector<HttpLaunch> {
  return async (launch, { onExit }) => {
    const transport = new StreamableHTTPClientTransport(new URL(launch.url), {
      requestInit: { headers: launch.headers },
      authProvider: launch.auth,
      fetch: launch.auth?.fetch
    });
    const client = new Client({ name: "openmcp", version: clientVersion });

    try {
      await client.connect(transport);
    } catch (error) {
      await transport.close().catch(() => {});
      throw connectError(error, launch);
    }

    let done = false;
    const timer = setInterval(() => {
      client.ping({ timeout: PING_TIMEOUT_MS }).catch((error: unknown) => {
        if (done) return;

        done = true;
        clearInterval(timer);
        void client.close().catch(() => {});
        onExit(`Lost connection: ${error instanceof Error ? error.message : String(error)}`);
      });
    }, pingEveryMs);

    return {
      client,
      pid: null,
      close: () => {
        done = true;
        clearInterval(timer);
        return client.close();
      }
    };
  };
}

export function connector(clientVersion: string, options: { pingEveryMs?: number } = {}): Connect {
  const stdio = stdioConnector(clientVersion);
  const http = httpConnector(clientVersion, options);

  return (launch, handlers) => (launch.type === "http" ? http(launch, handlers) : stdio(launch, handlers));
}

export async function describeServer(client: Client): Promise<ServerDetails> {
  const capabilities = client.getServerCapabilities() ?? {};

  const [tools, prompts, resources] = await Promise.all([
    capabilities.tools ? client.listTools().then((result) => result.tools) : null,
    capabilities.prompts ? client.listPrompts().then((result) => result.prompts) : null,
    capabilities.resources ? client.listResources().then((result) => result.resources) : null
  ]);

  return {
    info: client.getServerVersion() ?? null,
    protocolVersion: client.getNegotiatedProtocolVersion() ?? null,
    instructions: client.getInstructions() ?? null,
    tools,
    prompts,
    resources
  };
}
