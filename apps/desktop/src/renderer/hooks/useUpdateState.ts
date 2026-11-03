import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const updateKey = ["update-state"] as const;

export function useUpdateState() {
  const queryClient = useQueryClient();

  useEffect(() => window.api.on("updater:state", (state) => queryClient.setQueryData(updateKey, state)), [queryClient]);

  return useQuery({ queryKey: updateKey, queryFn: () => window.api.invoke("updater:state") });
}
