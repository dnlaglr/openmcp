import { useState } from "react";

// True once the value has changed since mount, so first paint never animates.
export function useChanged<T>(value: T) {
  const [seen, setSeen] = useState({ value, changed: false });
  if (!Object.is(seen.value, value)) setSeen({ value, changed: true });

  return seen.changed;
}
