import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { CATALOG_MIN_QUERY, type IpcInput } from "@openmcp/contracts";

import { useServers } from "@/features/servers/useServers";

const STALE_MS = 5 * 60 * 1000;
const catalogKey = ["catalog"] as const;
const updatesKey = [...catalogKey, "updates"] as const;

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

export function useUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: updatesKey });
    return window.api.on("servers:changed", refresh);
  }, [queryClient]);

  const { data: updates = [] } = useQuery({
    queryKey: updatesKey,
    queryFn: () => window.api.invoke("catalog:updates"),
    staleTime: STALE_MS
  });
  return updates;
}

export function useApplyUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: IpcInput<"catalog:update">) => window.api.invoke("catalog:update", input),
    // A stale check can promise a swap the new version no longer allows. The error shows once the refetch is done,
    // so reopening the dialog shows the form.
    onError: () => queryClient.invalidateQueries({ queryKey: updatesKey })
  });
}
