import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { CATALOG_MIN_QUERY, type IpcInput } from "@openmcp/contracts";

import { useServers } from "@/features/servers/useServers";

const STALE_MS = 5 * 60 * 1000;
const catalogKey = ["catalog"] as const;

export function usePopular() {
  return useQuery({
    queryKey: [...catalogKey, "popular"],
    queryFn: () => window.api.invoke("catalog:popular"),
    staleTime: STALE_MS
  });
}

export function useCatalogSearch(query: string) {
  return useInfiniteQuery({
    queryKey: [...catalogKey, "search", query],
    queryFn: ({ pageParam }) => window.api.invoke("catalog:search", { query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: query.length >= CATALOG_MIN_QUERY,
    staleTime: STALE_MS,
    placeholderData: keepPreviousData
  });
}

export function useInstallServer() {
  return useMutation({
    mutationFn: (input: IpcInput<"catalog:install">) => window.api.invoke("catalog:install", input)
  });
}

export function useInstalledServer() {
  const { data: servers = [] } = useServers();
  return (registryName: string) => servers.find((server) => server.registryName === registryName);
}

export function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return debounced;
}
