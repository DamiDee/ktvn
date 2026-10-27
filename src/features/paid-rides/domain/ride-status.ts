import type { Ride, RideStatus } from "./types.ts";

/**
 * The ride status machine shared with the backend.
 *
 * The server decides every transition; the client uses this table to
 * (1) refuse to regress when an old event arrives late, and (2) decide
 * which actions to offer. A re-dispatch after a driver cancels
 * (DRIVER_ASSIGNED → SEARCHING) is legal, which is why ordering prefers the
 * ride `version` over status rank whenever the server sends one.
 */

export const RIDE_TRANSITIONS: Record<RideStatus, readonly RideStatus[]> = {
  REQUESTED: ["SEARCHING", "NO_DRIVERS", "CANCELLED"],
  SEARCHING: ["DRIVER_ASSIGNED", "NO_DRIVERS", "CANCELLED"],
  NO_DRIVERS: ["SEARCHING", "CANCELLED"],
  DRIVER_ASSIGNED: ["DRIVER_EN_ROUTE", "DRIVER_ARRIVING", "DRIVER_ARRIVED", "SEARCHING", "CANCELLED"],
  DRIVER_EN_ROUTE: ["DRIVER_ARRIVING", "DRIVER_ARRIVED", "SEARCHING", "CANCELLED"],
  DRIVER_ARRIVING: ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "SEARCHING", "CANCELLED"],
  DRIVER_ARRIVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["PAUSED", "COMPLETED", "CANCELLED"],
  PAUSED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Progress rank, used only when the server sends no version. Statuses with
 * the same rank may move between each other (arriving ↔ en route, paused ↔
 * in progress).
 */
const RANK: Record<RideStatus, number> = {
  REQUESTED: 0,
  SEARCHING: 1,
  NO_DRIVERS: 2,
  DRIVER_ASSIGNED: 3,
  DRIVER_EN_ROUTE: 4,
  DRIVER_ARRIVING: 4,
  DRIVER_ARRIVED: 5,
  IN_PROGRESS: 6,
  PAUSED: 6,
  COMPLETED: 9,
  CANCELLED: 9,
};

export function statusRank(status: RideStatus): number {
  return RANK[status];
}

export function canTransition(from: RideStatus, to: RideStatus): boolean {
  return from === to || RIDE_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: RideStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}

/** A ride the passenger is still part of — drives restore-after-reload. */
export function isLive(status: RideStatus): boolean {
  return !isTerminal(status) && status !== "NO_DRIVERS";
}

/** A fresh login restores live trips, not the previous request's outcome. */
export function passengerRideForRestore(incoming: Ride | null, current: Ride | null): Ride | null {
  if (!incoming) return null;
  return isLive(incoming.status) || current?.id === incoming.id ? incoming : null;
}

export function hasDriver(status: RideStatus): boolean {
  return statusRank(status) >= RANK.DRIVER_ASSIGNED && status !== "CANCELLED" && status !== "COMPLETED";
}

export function isApproaching(status: RideStatus): boolean {
  return status === "DRIVER_ASSIGNED" || status === "DRIVER_EN_ROUTE" || status === "DRIVER_ARRIVING";
}

export function isOnTrip(status: RideStatus): boolean {
  return status === "IN_PROGRESS" || status === "PAUSED";
}

/** Passenger may cancel up to boarding; after that, safety tools take over. */
export function passengerCanCancel(status: RideStatus): boolean {
  return statusRank(status) <= RANK.DRIVER_ARRIVED && !isTerminal(status);
}

/** SOS is reachable from the moment a driver is assigned until the trip ends. */
export function sosAvailable(status: RideStatus): boolean {
  return hasDriver(status);
}

export function chatAvailable(status: RideStatus): boolean {
  return hasDriver(status);
}
