import { useEffect, useState } from "react";

export function useLinger<T>(value: T | null, ms: number): T | null {
  const [kept, setKept] = useState(value);
  if (value !== null && value !== kept) setKept(value);

  useEffect(() => {
    if (value !== null) return;

    const timer = setTimeout(() => setKept(null), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return value ?? kept;
}
