export type Presence = "entering" | "present" | "exiting";
export type Present<T> = { item: T; key: string; presence: Presence };

// Keeps removed items where they were so they can animate out, and marks items that arrived after the first render.
export function mergePresence<T>(
  previous: Present<T>[],
  next: T[],
  keyOf: (item: T) => string,
  first: boolean
): Present<T>[] {
  const before = new Map(previous.map((entry, index) => [entry.key, { entry, index }]));
  const merged: Present<T>[] = next.map((item) => {
    const key = keyOf(item);
    const known = before.get(key)?.entry;
    const presence = first ? "present" : known && known.presence !== "exiting" ? known.presence : "entering";
    return { item, key, presence };
  });

  const nextKeys = new Set(merged.map((entry) => entry.key));
  for (const [key, { entry, index }] of before) {
    if (!nextKeys.has(key)) merged.splice(Math.min(index, merged.length), 0, { ...entry, presence: "exiting" });
  }

  return merged;
}

export const settle = <T>(list: Present<T>[]): Present<T>[] =>
  list.filter((entry) => entry.presence !== "exiting").map((entry) => ({ ...entry, presence: "present" }));
