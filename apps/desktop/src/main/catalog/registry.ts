import { RegistryEntry, RegistryList, type CatalogEntry, type CatalogResults } from "@openmcp/contracts";

import { toCatalogEntry } from "./launch";

const DEFAULT_URL = "https://registry.modelcontextprotocol.io/v0.1";
const TIMEOUT_MS = 10_000;
const MIN_PAGE = 24;
const MAX_PAGES = 10;
const UNREADABLE = "The MCP Registry sent a response OpenMCP couldn't read. Try again in a moment.";

// Ordered by monthly npm downloads; GitHub's official server ships only as an OCI image.
export const POPULAR = [
  "io.github.microsoft/playwright-mcp",
  "io.github.ChromeDevTools/chrome-devtools-mcp",
  "io.github.upstash/context7",
  "io.github.github/github-mcp-server",
  "io.github.wonderwhy-er/desktop-commander",
  "io.github.firecrawl/firecrawl-mcp-server",
  "io.github.getsentry/sentry-mcp",
  "io.github.brave/brave-search-mcp-server"
];

async function get(path: string, params: Record<string, string | undefined> = {}): Promise<unknown> {
  const url = new URL(`${process.env.OPENMCP_REGISTRY_URL ?? DEFAULT_URL}${path}`);
  for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, value);

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    throw new Error("Couldn't reach the MCP Registry. Check your connection and try again.", { cause: error });
  }

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`The MCP Registry returned an error (${response.status}). Try again in a moment.`);

  return response.json().catch((error: unknown) => {
    throw new Error(UNREADABLE, { cause: error });
  });
}

const toEntries = (items: unknown[]) =>
  items.flatMap((item) => {
    const parsed = RegistryEntry.safeParse(item);
    const entry = parsed.success ? toCatalogEntry(parsed.data) : null;
    return entry ? [entry] : [];
  });

// Most registry entries are remote-only, so one registry page can hold few installable servers. Reading on until
// there's a full page keeps the renderer's infinite scroll from stalling on a short page.
// Gives up after MAX_PAGES (1,000 entries); a query that sparse returns a short page.
export async function searchRegistry(query: string, cursor?: string): Promise<CatalogResults> {
  const entries: CatalogEntry[] = [];
  let next = cursor;

  for (let pages = 0; pages < MAX_PAGES; pages++) {
    const params = { version: "latest", limit: "100", search: query, cursor: next };
    const page = RegistryList.safeParse(await get("/servers", params));
    if (!page.success) throw new Error(UNREADABLE);

    entries.push(...toEntries(page.data.servers ?? []));
    next = page.data.metadata.nextCursor;
    if (!next || entries.length >= MIN_PAGE) break;
  }

  return { entries, nextCursor: next ?? null };
}

export async function getRegistryServer(name: string, version: string): Promise<RegistryEntry | null> {
  const entry = RegistryEntry.safeParse(
    await get(`/servers/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`)
  );
  return entry.success ? entry.data : null;
}

export async function fetchPopular(): Promise<CatalogEntry[]> {
  const results = await Promise.allSettled(POPULAR.map((name) => getRegistryServer(name, "latest")));
  const entries = results
    .map((result) => (result.status === "fulfilled" && result.value ? toCatalogEntry(result.value) : null))
    .filter((entry) => entry !== null);

  const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (entries.length === 0 && failed) throw failed.reason;

  return entries;
}
