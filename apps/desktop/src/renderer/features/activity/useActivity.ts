import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient
} from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";

import { ACTIVITY_PAGE_SIZE, type ActivityCursor, type ActivityEntry, type ActivityScope } from "@openmcp/contracts";

const summaryKey = ["activity", "summary"] as const;
const trailKey = ["activity", "trail"] as const;

type Trail = InfiniteData<ActivityEntry[], ActivityCursor | undefined>;

export function useActivitySummary(scope: ActivityScope) {
  const queryClient = useQueryClient();

  useEffect(
    () => window.api.on("activity:changed", () => void queryClient.invalidateQueries({ queryKey: summaryKey })),
    [queryClient]
  );

  return useQuery({
    queryKey: [...summaryKey, scope],
    queryFn: () => window.api.invoke("activity:summary", scope),
    placeholderData: keepPreviousData
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

export function useVisibility(ref: RefObject<Element | null>, onChange: (visible: boolean) => void) {
  const changed = useEffectEvent(onChange);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => changed(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
}

function refreshTrail(queryClient: QueryClient) {
  queryClient.setQueriesData<Trail>(
    { queryKey: trailKey },
    (trail) => trail && { pages: trail.pages.slice(0, 1), pageParams: trail.pageParams.slice(0, 1) }
  );
  void queryClient.invalidateQueries({ queryKey: trailKey });
}

export function useLiveTrail(top: RefObject<Element | null>) {
  const queryClient = useQueryClient();
  const [hasNew, setHasNew] = useState(false);
  const inView = useRef(false);

  useVisibility(top, (visible) => {
    inView.current = visible;
    if (!visible || !hasNew) return;

    setHasNew(false);
    refreshTrail(queryClient);
  });

  const onChanged = useEffectEvent(() => (inView.current ? refreshTrail(queryClient) : setHasNew(true)));
  useEffect(() => window.api.on("activity:changed", () => onChanged()), []);

  return hasNew;
}
