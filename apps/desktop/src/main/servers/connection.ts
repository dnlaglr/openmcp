import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { Client } from "@modelcontextprotocol/client";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";

import type { LaunchSpec, ServerDetails } from "@openmcp/contracts";

export type Launch = Omit<LaunchSpec, "secretEnv">;

export type Connection = { client: Client; pid: number | null; close: () => Promise<void> };

export type Connect = (
  launch: Launch,
  handlers: { onLog: (text: string) => void; onExit: () => void }
) => Promise<Connection>;

export function stdioConnector(clientVersion: string): Connect {
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
