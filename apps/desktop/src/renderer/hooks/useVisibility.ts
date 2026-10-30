import { useEffect, useEffectEvent, type RefObject } from "react";

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
