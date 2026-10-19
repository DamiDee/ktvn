"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import { ADMIN_LIVE, adminData } from "./admin-data";
import { adminSocket, type AdminSocketEvent } from "./admin-socket";

/**
 * Keeps the admin workspace current.
 *
 * In live mode the socket's hints trigger REST refetches, and the safety and
 * live-ride lists also poll every 12 s as the doc's fallback (socket fan-out
 * is process-local on the server, so a hint can be missed).
 */

export const ADMIN_POLL_MS = ADMIN_LIVE ? 12_000 : false;

const root = queryKeys.admin.root[0];

function refetchFor(client: QueryClient, event: AdminSocketEvent) {
  const invalidate = (...key: string[]) => client.invalidateQueries({ queryKey: [root, ...key] });
  switch (event.kind) {
    case "ride":
      invalidate("live-rides");
      invalidate("overview");
      if (event.rideId) invalidate("live-ride", event.rideId);
      break;
    case "sos":
      invalidate("sos");
      invalidate("overview");
      invalidate("live-rides");
      invalidate("incidents");
      if (event.rideId) invalidate("live-ride", event.rideId);
      break;
    case "incident":
      invalidate("incidents");
      invalidate("overview");
      if (event.incidentId) invalidate("incident", event.incidentId);
      if (event.rideId) invalidate("live-ride", event.rideId);
      break;
    case "resync":
      invalidate();
      break;
  }
}

/** Mount once in the admin shell. */
export function useAdminLiveUpdates(): void {
  const client = useQueryClient();
  useEffect(() => {
    if (!ADMIN_LIVE) return;
    return adminSocket.subscribe((event) => refetchFor(client, event));
  }, [client]);
}

/** Follow one ride's own channel while its page is open. */
export function useAdminRideChannel(rideId: string): void {
  useEffect(() => {
    if (!ADMIN_LIVE) return;
    return adminSocket.watchRide(rideId);
  }, [rideId]);
}

/** The newest open SOS alert, shared by the shell banner and the dashboard. */
export function useActiveSos() {
  return useQuery({
    queryKey: queryKeys.admin.sos(),
    queryFn: () => adminData.getActiveSos(),
    refetchInterval: ADMIN_POLL_MS,
  });
}
