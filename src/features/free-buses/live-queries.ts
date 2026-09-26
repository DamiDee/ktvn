"use client";
import { useQuery } from "@tanstack/react-query";
import { freebusRequest } from "@/services/freebus-api";
import { useLiveUser } from "./live-shell";

/**
 * How often a resource is worth re-reading.
 *
 * Polling everything on one short timer means a phone in a pocket asks the API
 * for the list of bus stops every ten seconds. Each resource instead gets a
 * cadence that matches how often it actually changes.
 */
export type Cadence = "reference" | "operational" | "live";

const TIERS: Record<Cadence, { staleTime: number; interval: number | false; onFocus: boolean }> = {
  /** Stops, routes and accounts change when an admin edits them, and not otherwise. */
  reference: { staleTime: 10 * 60_000, interval: false, onFocus: false },
  /** Schedules and demand move a few times a day. */
  operational: { staleTime: 60_000, interval: 120_000, onFocus: true },
  /** Seats and boarding state move while a service is running. */
  live: { staleTime: 15_000, interval: 30_000, onFocus: true },
};

const REFERENCE = /^(points|routes|users)(\/|\?|$)/;
const OPERATIONAL = /^(trips|ride-requests|logs)(\/|\?|$)/;

export function cadenceFor(path: string): Cadence {
  if (REFERENCE.test(path)) return "reference";
  if (OPERATIONAL.test(path)) return "operational";
  return "live";
}

export function useLiveQuery<T>(path: string, enabled = true, cadence: Cadence = cadenceFor(path)) {
  const user = useLiveUser();
  const tier = TIERS[cadence];
  return useQuery({
    queryKey: ["freebus-live", user.id, path],
    queryFn: ({ signal }) => freebusRequest<T>(path, { signal }),
    enabled,
    staleTime: tier.staleTime,
    // Keep answers around long enough that moving between screens is free.
    gcTime: 15 * 60_000,
    // A backgrounded tab asks for nothing; it catches up when it comes back.
    refetchInterval: () =>
      enabled && tier.interval !== false && !(typeof document !== "undefined" && document.hidden)
        ? tier.interval
        : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: tier.onFocus,
    retry: false,
  });
}
