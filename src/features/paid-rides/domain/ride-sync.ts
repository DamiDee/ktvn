import { isTerminal, statusRank } from "./ride-status.ts";
import type { LiveLocation, Ride, RideEvent } from "./types.ts";

/**
 * Server-authoritative synchronisation rules.
 *
 * Snapshots and events can arrive late, twice, or out of order — after a
 * reconnect, from a slow request racing a fast socket, or from a tab that
 * slept. These pure functions decide whether incoming data may replace what
 * the client already holds. They never invent state.
 */

export type SnapshotVerdict = "apply" | "stale" | "different-ride";

export function compareSnapshot(current: Ride | null, incoming: Ride): SnapshotVerdict {
  if (!current) return "apply";
  if (current.id !== incoming.id) return "different-ride";

  // A version is authoritative when both sides carry one.
  if (Number.isFinite(current.version) && Number.isFinite(incoming.version)) {
    return incoming.version > current.version ? "apply" : "stale";
  }

  // Without versions, never leave a terminal state and never go backwards.
  if (isTerminal(current.status)) return "stale";
  return statusRank(incoming.status) >= statusRank(current.status) ? "apply" : "stale";
}

/** A location update only lands if it is newer than the one on screen. */
export function isNewerLocation(current: LiveLocation | undefined, incoming: LiveLocation): boolean {
  if (!current) return true;
  return Date.parse(incoming.recordedAt) > Date.parse(current.recordedAt);
}

/** Bounded memory of seen event ids, oldest dropped first. */
export const SEEN_EVENT_LIMIT = 256;

export function rememberEvent(seen: readonly string[], id: string): string[] {
  const next = seen.length >= SEEN_EVENT_LIMIT ? seen.slice(seen.length - SEEN_EVENT_LIMIT + 1) : seen.slice();
  next.push(id);
  return next;
}

export interface SequenceCheck {
  duplicate: boolean;
  /** A gap means events were missed; the caller must fetch a fresh snapshot. */
  gap: boolean;
  nextSeq: number | null;
}

export function checkSequence(lastSeq: number | null, seen: readonly string[], event: RideEvent): SequenceCheck {
  if (seen.includes(event.id)) return { duplicate: true, gap: false, nextSeq: lastSeq };
  if (event.seq === null) return { duplicate: false, gap: false, nextSeq: lastSeq };
  if (lastSeq !== null && event.seq <= lastSeq) return { duplicate: true, gap: false, nextSeq: lastSeq };
  const gap = lastSeq !== null && event.seq > lastSeq + 1;
  return { duplicate: false, gap, nextSeq: event.seq };
}

/**
 * Apply a thin location event to a ride. ETA and distance only change when
 * the server sends route-aware values; the client never derives a critical
 * ETA from straight-line distance.
 */
export function applyLocation(
  ride: Ride,
  location: LiveLocation,
  approach?: Ride["approach"],
  progress?: Ride["progress"],
): Ride {
  if (!isNewerLocation(ride.driverLocation, location)) return ride;
  return {
    ...ride,
    driverLocation: location,
    approach: approach ? { ...ride.approach, ...approach } : ride.approach,
    progress: progress ?? ride.progress,
  };
}
