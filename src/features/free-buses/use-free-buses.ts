"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { freeBusService } from "@/services/free-bus-service";

export const FREE_BUSES_KEY = ["free-buses"] as const;

export function useFreeBuses(enabled = true) {
  const client = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    return freeBusService.subscribe(() => { void client.invalidateQueries({ queryKey: FREE_BUSES_KEY }); });
  }, [client, enabled]);
  return useQuery({
    queryKey: FREE_BUSES_KEY,
    queryFn: freeBusService.snapshot,
    enabled,
    staleTime: 0,
    refetchInterval: enabled ? 10_000 : false,
    refetchOnWindowFocus: true,
  });
}
