import { StreamableHTTPClientTransport, type JSONRPCMessage } from "@modelcontextprotocol/client";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";

const url = process.env.OPENMCP_URL;
const token = process.env.OPENMCP_TOKEN;

if (!url || !token) {
  process.stderr.write("Set OPENMCP_URL and OPENMCP_TOKEN. OpenMCP writes both into Claude Desktop's config.\n");
  process.exit(1);
}

const stdio = new StdioServerTransport();
const http = new StreamableHTTPClientTransport(new URL(url), {
  requestInit: { headers: { Authorization: `Bearer ${token}` } }
});

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

function unreachable(message: JSONRPCMessage, error: unknown) {
  if (!("method" in message) || !("id" in message)) return console.error(reason(error));

  void stdio.send({
    jsonrpc: "2.0",
    id: message.id,
    error: {
      code: -32000,
      message: `OpenMCP isn't reachable at ${url} (${reason(error)}). Make sure OpenMCP is running, then restart Claude Desktop.`
    }
  });
}

stdio.onmessage = (message) => void http.send(message).catch((error: unknown) => unreachable(message, error));

http.onmessage = (message) => {
  const version = "result" in message ? (message.result as { protocolVersion?: unknown }).protocolVersion : undefined;
  if (typeof version === "string") http.setProtocolVersion(version);

  void stdio.send(message);
};

http.onerror = (error) => console.error(error.message);
stdio.onerror = (error) => console.error(error.message);
stdio.onclose = () =>
  void http
    .terminateSession()
    .catch(() => {})
    .finally(() => http.close())
    .finally(() => process.exit(0));

void http.start().then(() => stdio.start());
