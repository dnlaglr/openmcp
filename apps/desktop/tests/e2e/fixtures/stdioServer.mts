import { createInterface } from "node:readline";

type Message = {
  id?: number | string;
  method?: string;
  params?: { protocolVersion?: string; cursor?: string; name?: string; arguments?: Record<string, unknown> };
};

const write = (message: object) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);

const echo = {
  name: "echo",
  description: "Echoes back the input.",
  inputSchema: {
    type: "object",
    properties: { message: { type: "string", description: "Text to echo" } },
    required: ["message"]
  },
  annotations: { readOnlyHint: true }
};

const fail = {
  name: "fail",
  description: "Always fails.",
  inputSchema: { type: "object", properties: { reason: { type: "string" } } }
};

const add = {
  name: process.env.FIXTURE_TOOL ?? "add",
  description: "Adds two numbers.",
  inputSchema: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } }, required: ["a", "b"] }
};

function call(params: Message["params"]) {
  const args = params?.arguments ?? {};
  if (params?.name === "echo") return { content: [{ type: "text", text: args.message ?? "" }] };
  if (params?.name === "fail") {
    return { content: [{ type: "text", text: `Failed: ${String(args.reason ?? "on purpose")}` }], isError: true };
  }

  const sum = Number(args.a) + Number(args.b);
  return { content: [{ type: "text", text: String(sum) }], structuredContent: { sum } };
}

const handlers: Record<string, (params: Message["params"]) => unknown> = {
  initialize: (params) => ({
    protocolVersion: params?.protocolVersion,
    capabilities: { tools: {}, resources: {} },
    serverInfo: { name: "fixture", version: "1.0.0" },
    instructions: "Use echo to test the connection."
  }),
  "tools/list": (params) => (params?.cursor ? { tools: [add] } : { tools: [echo, fail], nextCursor: "page-2" }),
  "tools/call": call,
  "resources/list": () => ({ resources: [{ uri: "fixture://readme", name: "readme", mimeType: "text/plain" }] }),
  ping: () => ({})
};

process.stderr.write(`fixture ready pid=${process.pid}\n`);

createInterface({ input: process.stdin }).on("line", (line) => {
  const { id, method = "", params } = JSON.parse(line) as Message;

  if (method === "notifications/initialized" && process.env.FIXTURE_EXIT_AFTER_MS) {
    setTimeout(() => process.exit(1), Number(process.env.FIXTURE_EXIT_AFTER_MS));
  }
  if (id === undefined) return;

  const handler = handlers[method];
  write(
    handler ? { id, result: handler(params) } : { id, error: { code: -32601, message: `Unknown method ${method}` } }
  );
});
