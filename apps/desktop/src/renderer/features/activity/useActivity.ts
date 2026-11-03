import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient
} from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";

import {
  ACTIVITY_PAGE_SIZE,
  type ActivityCursor,
  type ActivityEntry,
  type ActivityScope,
  type ActivitySummaryQuery
} from "@openmcp/contracts";

import { useVisibility } from "@/hooks/useVisibility";

const summaryKey = ["activity", "summary"] as const;
const trailKey = ["activity", "trail"] as const;
const seriesKey = ["activity", "series"] as const;

type Trail = InfiniteData<ActivityEntry[], ActivityCursor | undefined>;

export function useActivitySummary(query: ActivitySummaryQuery) {
  const queryClient = useQueryClient();

  useEffect(
    () => window.api.on("activity:changed", () => void queryClient.invalidateQueries({ queryKey: summaryKey })),
    [queryClient]
  );

  return useQuery({
    queryKey: [...summaryKey, query],
    queryFn: () => window.api.invoke("activity:summary", query),
    placeholderData: keepPreviousData
  });
}

export function useActivitySeries(scope: ActivityScope) {
  const queryClient = useQueryClient();

  useEffect(
    () => window.api.on("activity:changed", () => void queryClient.invalidateQueries({ queryKey: seriesKey })),
    [queryClient]
  );

  return useQuery({
    queryKey: [...seriesKey, scope],
    queryFn: () => window.api.invoke("activity:series", scope),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000
  });
}

export function useActivityTrail(scope: ActivityScope, failuresOnly: boolean) {
  return useInfiniteQuery({
    queryKey: [...trailKey, scope, failuresOnly],
    queryFn: ({ pageParam }) => window.api.invoke("activity:list", { ...scope, failuresOnly, before: pageParam }),
    initialPageParam: undefined as ActivityCursor | undefined,
    getNextPageParam: (page) => {
      const last = page.at(-1);
      return last && page.length === ACTIVITY_PAGE_SIZE ? { at: last.at, id: last.id } : undefined;
    },
    placeholderData: keepPreviousData
  });
}

function refreshTrail(queryClient: QueryClient) {
  queryClient.setQueriesData<Trail>(
    { queryKey: trailKey },
    (trail) => trail && { pages: trail.pages.slice(0, 1), pageParams: trail.pageParams.slice(0, 1) }
  );
  void queryClient.invalidateQueries({ queryKey: trailKey });
}

export function useLiveTrail(top: RefObject<Element | null>, calls: number) {
  const queryClient = useQueryClient();
  const [hasNew, setHasNew] = useState(false);
  const [seen, setSeen] = useState(calls);
  const inView = useRef(false);

  useVisibility(top, (visible) => {
    inView.current = visible;
    setSeen(calls);
    if (!visible || !hasNew) return;

    setHasNew(false);
    refreshTrail(queryClient);
  });

  const onChanged = useEffectEvent(() => (inView.current ? refreshTrail(queryClient) : setHasNew(true)));
  useEffect(() => window.api.on("activity:changed", () => onChanged()), []);

  return hasNew ? Math.max(1, calls - seen) : 0;
}
