import { describe, expect, test, vi } from "vitest";

import { fetchPopular, getRegistryServer, POPULAR, searchRegistry } from "../../src/main/catalog/registry";

const installable = (name: string) => ({
  server: {
    name: `io.github.acme/${name}`,
    description: "Acme tools",
    version: "1.0.0",
    packages: [{ registryType: "npm", identifier: `@acme/${name}`, version: "1.0.0", transport: { type: "stdio" } }]
  }
});
const remoteOnly = (name: string) => ({
  server: { name: `io.github.acme/${name}`, description: "Acme tools", version: "1.0.0", remotes: [{ type: "sse" }] }
});
const many = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => installable(`${prefix}${index}`));
const page = (servers: unknown[], nextCursor?: string) =>
  Response.json({ servers, metadata: { count: servers.length, nextCursor } });

function stubFetch(...replies: Array<Response | Error>) {
  const fetchMock = vi.fn<typeof fetch>(async () => {
    const reply = replies.shift();
    if (!reply) throw new Error("Unexpected fetch");
    if (reply instanceof Error) throw reply;
    return reply;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const requested = (fetchMock: ReturnType<typeof stubFetch>, call = 0) => new URL(String(fetchMock.mock.calls[call][0]));

describe("searchRegistry", () => {
  test("keeps reading registry pages until it has a full page of installable servers", async () => {
    const fetchMock = stubFetch(page(many(10, "a"), "c1"), page(many(20, "b"), "c2"));

    const results = await searchRegistry("acme");

    expect(results.entries).toHaveLength(30);
    expect(results.nextCursor).toBe("c2");
    expect(Object.fromEntries(requested(fetchMock).searchParams)).toEqual({
      version: "latest",
      limit: "100",
      search: "acme"
    });
    expect(requested(fetchMock, 1).searchParams.get("cursor")).toBe("c1");
  });

  test("stops at the last page", async () => {
    const fetchMock = stubFetch(page(many(3, "a")));

    expect(await searchRegistry("acme")).toMatchObject({ nextCursor: null, entries: [{}, {}, {}] });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("drops entries it can't parse or install", async () => {
    stubFetch(page([installable("ok"), remoteOnly("remote"), { server: { name: 42 } }]));

    const { entries } = await searchRegistry("acme");
    expect(entries.map((entry) => entry.name)).toEqual(["io.github.acme/ok"]);
  });

  test("uses OPENMCP_REGISTRY_URL when it's set", async () => {
    vi.stubEnv("OPENMCP_REGISTRY_URL", "http://127.0.0.1:9999/v0.1");
    const fetchMock = stubFetch(page([]));

    await searchRegistry("acme");
    expect(requested(fetchMock).href.startsWith("http://127.0.0.1:9999/v0.1/servers?")).toBe(true);
  });

  test("explains network failures, error statuses and unreadable responses", async () => {
    stubFetch(new TypeError("fetch failed"));
    await expect(searchRegistry("acme")).rejects.toThrow(
      "Couldn't reach the MCP Registry. Check your connection and try again."
    );

    stubFetch(new Response("", { status: 503 }));
    await expect(searchRegistry("acme")).rejects.toThrow(
      "The MCP Registry returned an error (503). Try again in a moment."
    );

    stubFetch(new Response("<html>", { status: 200 }));
    await expect(searchRegistry("acme")).rejects.toThrow(
      "The MCP Registry sent a response OpenMCP couldn't read. Try again in a moment."
    );

    stubFetch(Response.json({ unexpected: true }));
    await expect(searchRegistry("acme")).rejects.toThrow(
      "The MCP Registry sent a response OpenMCP couldn't read. Try again in a moment."
    );
  });
});

describe("getRegistryServer", () => {
  test("fetches one version by its encoded name", async () => {
    const fetchMock = stubFetch(Response.json(installable("x")));

    expect(await getRegistryServer("io.github.acme/x", "latest")).toMatchObject({
      server: { name: "io.github.acme/x" }
    });
    expect(requested(fetchMock).pathname).toBe("/v0.1/servers/io.github.acme%2Fx/versions/latest");
  });

  test("returns null for a version the registry doesn't have", async () => {
    stubFetch(new Response("", { status: 404 }));
    expect(await getRegistryServer("io.github.acme/x", "9.9.9")).toBeNull();
  });
});

describe("fetchPopular", () => {
  test("skips popular servers that fail and keeps the rest", async () => {
    stubFetch(new TypeError("fetch failed"), ...POPULAR.slice(1).map((name) => Response.json(installable(name))));
    expect(await fetchPopular()).toHaveLength(POPULAR.length - 1);
  });

  test("fails when every popular server fails", async () => {
    stubFetch(...POPULAR.map(() => new TypeError("fetch failed")));
    await expect(fetchPopular()).rejects.toThrow("Couldn't reach the MCP Registry.");
  });
});
