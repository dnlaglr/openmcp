import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { ClientId, ClientState, IpcInput } from "@openmcp/contracts";

import { isActiveNow } from "./agentStatus";
import { useNow } from "@/hooks/useNow";

const clientsKey = ["clients"] as const;

export function useClients() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: clientsKey });
    const offClients = window.api.on("clients:changed", refresh);
    const offActivity = window.api.on("activity:changed", refresh);

    return () => {
      offClients();
      offActivity();
    };
  }, [queryClient]);

  return useQuery({ queryKey: clientsKey, queryFn: () => window.api.invoke("clients:list") });
}

// Ticks so "active" lapses two minutes after the last call without waiting for an event.
export function useAgentCounts() {
  const { data: clients = [] } = useClients();
  const now = useNow(true);
  const installed = clients.filter((client) => client.status !== "missing");

  return {
    installed: installed.length,
    connected: installed.filter((client) => client.status === "connected" || client.status === "outdated").length,
    active: installed.filter((client) => isActiveNow(client, now)).length
  };
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
