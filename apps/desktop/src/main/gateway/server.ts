import {
  ProtocolError,
  ProtocolErrorCode,
  ResourceNotFoundError,
  Server,
  type ServerContext
} from "@modelcontextprotocol/server";
import type { Client, RequestOptions } from "@modelcontextprotocol/client";

import type { NewActivity } from "@openmcp/database";

import type { CallKind, Catalog, Target } from "./catalog";
import type { Supervisor } from "../servers/supervisor";

const CALL_TIMEOUT_MS = 10 * 60_000;

type GatewayServerOptions = {
  catalog: Pick<Catalog, "tools" | "prompts" | "resources" | "templates" | "resolve">;
  supervisor: Pick<Supervisor, "client">;
  record: (activity: NewActivity) => void;
  version: string;
};

function forward(ctx: ServerContext): RequestOptions {
  const progressToken = ctx.mcpReq._meta?.progressToken;

  return {
    signal: ctx.mcpReq.signal,
    timeout: CALL_TIMEOUT_MS,
    resetTimeoutOnProgress: true,
    onprogress: (progress) => {
      if (progressToken === undefined) return;
      void ctx.mcpReq.notify({ method: "notifications/progress", params: { ...progress, progressToken } });
    }
  };
}

function unavailable(kind: CallKind, name: string) {
  return kind === "resource"
    ? new ResourceNotFoundError(name)
    : new ProtocolError(ProtocolErrorCode.InvalidParams, `Unknown ${kind} ${name}`);
}

export function createGatewayServer({ catalog, supervisor, record, version }: GatewayServerOptions) {
  return () => {
    const server = new Server(
      { name: "openmcp", version },
      {
        capabilities: { tools: { listChanged: true }, prompts: { listChanged: true }, resources: { listChanged: true } }
      }
    );

    async function call<T extends object>(
      kind: CallKind,
      name: string,
      ctx: ServerContext,
      run: (client: Client, target: Target, options: RequestOptions) => Promise<T>
    ) {
      const at = new Date();
      const started = performance.now();
      const target = catalog.resolve(kind, name);
      const client = target ? supervisor.client(target.serverId) : undefined;

      const finish = (outcome: NewActivity["outcome"], error: string | null = null) => {
        try {
          record({
            at,
            kind,
            name: target?.name ?? name,
            serverId: target?.serverId ?? null,
            serverName: target?.serverName ?? null,
            client: server.getClientVersion()?.name ?? null,
            durationMs: Math.round(performance.now() - started),
            outcome,
            error
          });
        } catch (failure) {
          console.error("Couldn't record gateway activity", failure);
        }
      };

      if (!target || !client) {
        const error = unavailable(kind, name);
        finish("unavailable", error.message);
        throw error;
      }

      try {
        const result = await run(client, target, forward(ctx));
        finish("isError" in result && result.isError === true ? "tool_error" : "ok");
        return result;
      } catch (error) {
        finish("error", error instanceof Error ? error.message : String(error));
        throw error;
      }
    }

    server.setRequestHandler("tools/list", () => ({ tools: catalog.tools() }));
    server.setRequestHandler("prompts/list", () => ({ prompts: catalog.prompts() }));
    server.setRequestHandler("resources/list", () => ({ resources: catalog.resources() }));
    server.setRequestHandler("resources/templates/list", () => ({ resourceTemplates: catalog.templates() }));

    server.setRequestHandler("tools/call", ({ params }, ctx) =>
      call("tool", params.name, ctx, (client, target, options) =>
        client.callTool({ name: target.name, arguments: params.arguments }, options)
      )
    );
    server.setRequestHandler("prompts/get", ({ params }, ctx) =>
      call("prompt", params.name, ctx, (client, target, options) =>
        client.getPrompt({ name: target.name, arguments: params.arguments }, options)
      )
    );
    server.setRequestHandler("resources/read", ({ params }, ctx) =>
      call("resource", params.uri, ctx, (client, _target, options) => client.readResource({ uri: params.uri }, options))
    );

    return server;
  };
}
