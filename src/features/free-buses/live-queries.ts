"use client";
import { useQuery } from "@tanstack/react-query";
import { freebusRequest } from "@/services/freebus-api";
import { useLiveUser } from "./live-shell";

export function useLiveQuery<T>(path: string, enabled = true) {
  const user = useLiveUser();
  return useQuery({
    queryKey: ["freebus-live", user.id, path],
    queryFn: ({ signal }) => freebusRequest<T>(path, { signal }),
    enabled, staleTime: 2_000, refetchInterval: enabled ? 10_000 : false,
    refetchOnWindowFocus: true, retry: false,
  });
}
