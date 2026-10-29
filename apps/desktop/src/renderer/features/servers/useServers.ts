import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { IpcInput } from "@openmcp/contracts";

const serversKey = ["servers"] as const;

export function useServers() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: serversKey });
    return window.api.on("servers:changed", refresh);
  }, [queryClient]);

  return useQuery({ queryKey: serversKey, queryFn: () => window.api.invoke("servers:list") });
}

export function useAddCustomServer() {
  return useMutation({
    mutationFn: (input: IpcInput<"servers:addCustom">) => window.api.invoke("servers:addCustom", input)
  });
}

export function useRemoveServer() {
  return useMutation({ mutationFn: (id: string) => window.api.invoke("servers:remove", { id }) });
}
