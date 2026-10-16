"use client";

import { isLive } from "../domain/ride-status";
import { accountSession } from "@/lib/account-session";
import type { Ride } from "../domain/types";

/**
 * Finished rides the person has already closed on this tab. The server keeps
 * returning a just-finished ride for a while (so a reload still shows the
 * receipt); once it has been dismissed here, a refresh shouldn't bring the
 * summary back. Session-scoped and holds ride ids only.
 */

const KEY = "kx-rides:dismissed";
accountSession.subscribe(() => { try { sessionStorage.removeItem(KEY); } catch { /* unavailable */ } });

function read(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function dismissRideLocally(rideId: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify([...read().filter((id) => id !== rideId), rideId].slice(-20)));
  } catch {
    // Without storage the summary may simply reappear after a reload.
  }
}

/** Drop a finished ride the person already dismissed; live rides always pass. */
export function withoutDismissed(ride: Ride | null): Ride | null {
  if (!ride || isLive(ride.status)) return ride;
  return read().includes(ride.id) ? null : ride;
}
