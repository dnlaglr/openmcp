import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { MAX_LOG_LINES, type IpcInput, type LogLine, type ServerState } from "@openmcp/contracts";

const serversKey = ["servers"] as const;
const statesKey = ["server-states"] as const;
const logsKey = (id: string) => ["server-logs", id] as const;

export type ServerAction = "start" | "stop" | "restart";

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

export function useUpdateServer() {
  return useMutation({
    mutationFn: (input: IpcInput<"servers:update">) => window.api.invoke("servers:update", input)
  });
}

export function useRemoveServer() {
  return useMutation({ mutationFn: (id: string) => window.api.invoke("servers:remove", { id }) });
}

export function useServerStates() {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      window.api.on("servers:state", (state) =>
        queryClient.setQueryData<ServerState[]>(statesKey, (states = []) => [
          ...states.filter((existing) => existing.id !== state.id),
          state
        ])
      ),
    [queryClient]
  );

  const { data: states = [] } = useQuery({ queryKey: statesKey, queryFn: () => window.api.invoke("servers:states") });

  return (id: string): ServerState =>
    states.find((state) => state.id === id) ?? {
      id,
      status: "stopped",
      error: null,
      restarts: 0,
      pid: null,
      startedAt: null
    };
}

export function useServerAction() {
  return useMutation({
    mutationFn: ({ action, id }: { action: ServerAction; id: string }) => window.api.invoke(`servers:${action}`, { id })
  });
}

const signedInKey = ["servers-signed-in"] as const;

export function useSignIn() {
  return useMutation({ mutationFn: (id: string) => window.api.invoke("servers:signIn", { id }) });
}

export function useSignOut() {
  return useMutation({ mutationFn: (id: string) => window.api.invoke("servers:signOut", { id }) });
}

export function useSignedIn() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: signedInKey });
    return window.api.on("servers:changed", refresh);
  }, [queryClient]);

  return useQuery({ queryKey: signedInKey, queryFn: () => window.api.invoke("servers:signedIn") });
}

export function useServerLogs(id: string) {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      window.api.on("servers:log", (line) => {
        if (line.serverId !== id) return;

        queryClient.setQueryData<LogLine[]>(logsKey(id), (lines) => lines && [...lines, line].slice(-MAX_LOG_LINES));
      }),
    [queryClient, id]
  );

  return useQuery({ queryKey: logsKey(id), queryFn: () => window.api.invoke("servers:logs", { id }) });
}

export function useServerDetails(state: ServerState) {
  return useQuery({
    queryKey: ["server-details", state.id, state.startedAt],
    queryFn: () => window.api.invoke("servers:details", { id: state.id }),
    enabled: state.status === "running"
  });
}
