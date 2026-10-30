import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const stateKey = ["gateway-state"] as const;
const connectionKey = ["gateway-connection"] as const;

export function useGatewayState() {
  const queryClient = useQueryClient();

  useEffect(() => window.api.on("gateway:state", (state) => queryClient.setQueryData(stateKey, state)), [queryClient]);

  return useQuery({ queryKey: stateKey, queryFn: () => window.api.invoke("gateway:state") });
}

export function useGatewayConnection() {
  return useQuery({ queryKey: connectionKey, queryFn: () => window.api.invoke("gateway:connection") });
}

export function useSetGatewayPort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (port: number) => window.api.invoke("gateway:setPort", { port }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionKey })
  });
}

export function useRegenerateGatewayToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => window.api.invoke("gateway:regenerateToken"),
    onSuccess: (connection) => queryClient.setQueryData(connectionKey, connection)
  });
}
