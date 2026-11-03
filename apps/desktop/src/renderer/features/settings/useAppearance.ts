import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { Appearance } from "@openmcp/contracts";

const appearanceKey = ["appearance"] as const;
const dark = matchMedia("(prefers-color-scheme: dark)");

function repainted() {
  return new Promise<void>((resolve) => {
    const done = () => {
      dark.removeEventListener("change", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 300);
    dark.addEventListener("change", done);
  });
}

export function useAppearance() {
  return useQuery({ queryKey: appearanceKey, queryFn: () => window.api.invoke("app:appearance") });
}

export function useSetAppearance() {
  const queryClient = useQueryClient();

  return async (appearance: Appearance) => {
    const root = document.documentElement;
    root.classList.add("theme-switch");

    try {
      await document.startViewTransition(async () => {
        queryClient.setQueryData(appearanceKey, appearance);
        await window.api.invoke("app:setAppearance", appearance);
        await repainted();
      }).finished;
    } finally {
      root.classList.remove("theme-switch");
    }
  };
}
