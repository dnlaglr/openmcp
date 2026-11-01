import { useEffect, useState } from "react";

import { mergePresence, settle, type Present } from "@/lib/presence";

export function usePresence<T>(items: T[], keyOf: (item: T) => string, ms = 260): Present<T>[] {
  const signature = items.map(keyOf).join("\n");
  const [state, setState] = useState(() => ({ signature, list: mergePresence<T>([], items, keyOf, true) }));
  if (state.signature !== signature) setState({ signature, list: mergePresence(state.list, items, keyOf, false) });

  const transient = state.list.some((entry) => entry.presence !== "present");
  useEffect(() => {
    if (!transient) return;

    const timer = setTimeout(() => setState((current) => ({ ...current, list: settle(current.list) })), ms);
    return () => clearTimeout(timer);
  }, [transient, state.list, ms]);

  const fresh = new Map(items.map((item) => [keyOf(item), item]));
  return state.list.map((entry) => ({ ...entry, item: fresh.get(entry.key) ?? entry.item }));
}
