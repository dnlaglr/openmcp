import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { ClientId, ClientState, IpcInput } from "@openmcp/contracts";

const clientsKey = ["clients"] as const;

export function useClients() {
  const queryClient = useQueryClient();

  useEffect(
    () => window.api.on("clients:changed", () => void queryClient.invalidateQueries({ queryKey: clientsKey })),
    [queryClient]
  );

  return useQuery({ queryKey: clientsKey, queryFn: () => window.api.invoke("clients:list") });
}

export function useClientAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, connect }: { id: ClientId; connect: boolean }) =>
      window.api.invoke(connect ? "clients:connect" : "clients:disconnect", { id }),
    onSuccess: (state) =>
      queryClient.setQueryData<ClientState[]>(clientsKey, (states) =>
        states?.map((existing) => (existing.id === state.id ? state : existing))
      )
  });
}

export function useRevealClient() {
  return useMutation({ mutationFn: (input: IpcInput<"clients:reveal">) => window.api.invoke("clients:reveal", input) });
}
