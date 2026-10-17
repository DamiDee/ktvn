"use client";

import { useQuery } from "@tanstack/react-query";
import { getRideService } from "../services";

/** One account query shared by the shell, map and profile; refresh approval on return. */
export function useRideViewer() {
  return useQuery({
    queryKey: ["paid-rides", "viewer"],
    queryFn: ({ signal }) => getRideService().getViewer(signal),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
