import type { DriverSessionState } from "./driver-session.ts";
import type { RideSessionState } from "./ride-session.ts";
import type { Place } from "./types.ts";

/**
 * UI phases are *derived*, never stored. Screens switch on one phase value
 * instead of combining booleans like `isSearching && hasDriver`.
 *
 * Connection, location and SOS are orthogonal overlays: a dropped socket
 * shows a "Reconnecting…" pill over the trip, it does not replace the trip.
 */

export type BookingStep = "home" | "search" | "pickup-pin" | "options";

export interface BookingDraft {
  step: BookingStep;
  /** Which field the search panel is editing. */
  field: "pickup" | "destination";
  pickup: Place | null;
  destination: Place | null;
  optionId: string | null;
  paymentMethodId: string | null;
}

export const emptyDraft: BookingDraft = {
  step: "home",
  field: "destination",
  pickup: null,
  destination: null,
  optionId: null,
  paymentMethodId: null,
};

export type PassengerPhase =
  | "RESTORING"
  | "IDLE"
  | "SELECTING_PICKUP"
  | "SELECTING_DESTINATION"
  | "CONFIRMING_PICKUP"
  | "ROUTE_PREVIEW"
  | "REQUESTING_RIDE"
  | "SEARCHING_DRIVERS"
  | "NO_DRIVERS_AVAILABLE"
  | "DRIVER_MATCHED"
  | "DRIVER_EN_ROUTE"
  | "DRIVER_ARRIVING"
  | "DRIVER_ARRIVED"
  | "TRIP_ACTIVE"
  | "TRIP_PAUSED"
  | "TRIP_COMPLETED"
  | "PAYMENT_FAILED"
  | "CANCELLED_BY_PASSENGER"
  | "CANCELLED_BY_DRIVER"
  | "CANCELLED_BY_SYSTEM";

export function derivePassengerPhase(draft: BookingDraft, session: RideSessionState): PassengerPhase {
  const ride = session.ride;

  if (ride) {
    switch (ride.status) {
      case "REQUESTED":
        return "REQUESTING_RIDE";
      case "SEARCHING":
        return "SEARCHING_DRIVERS";
      case "NO_DRIVERS":
        return "NO_DRIVERS_AVAILABLE";
      case "DRIVER_ASSIGNED":
        return "DRIVER_MATCHED";
      case "DRIVER_EN_ROUTE":
        return "DRIVER_EN_ROUTE";
      case "DRIVER_ARRIVING":
        return "DRIVER_ARRIVING";
      case "DRIVER_ARRIVED":
        return "DRIVER_ARRIVED";
      case "IN_PROGRESS":
        return "TRIP_ACTIVE";
      case "PAUSED":
        return "TRIP_PAUSED";
      case "COMPLETED":
        return ride.payment.status === "failed" ? "PAYMENT_FAILED" : "TRIP_COMPLETED";
      case "CANCELLED":
        return ride.cancellation?.by === "driver"
          ? "CANCELLED_BY_DRIVER"
          : ride.cancellation?.by === "system"
            ? "CANCELLED_BY_SYSTEM"
            : "CANCELLED_BY_PASSENGER";
    }
  }

  if (session.pending === "request") return "REQUESTING_RIDE";
  if (session.bootstrap === "idle" || session.bootstrap === "loading") return "RESTORING";

  switch (draft.step) {
    case "search":
      return draft.field === "pickup" ? "SELECTING_PICKUP" : "SELECTING_DESTINATION";
    case "pickup-pin":
      return "CONFIRMING_PICKUP";
    case "options":
      return draft.pickup && draft.destination ? "ROUTE_PREVIEW" : "IDLE";
    default:
      return "IDLE";
  }
}

/** Phases in which a driver is attached and visible on the map. */
export function phaseShowsDriver(phase: PassengerPhase): boolean {
  return (
    phase === "DRIVER_MATCHED" ||
    phase === "DRIVER_EN_ROUTE" ||
    phase === "DRIVER_ARRIVING" ||
    phase === "DRIVER_ARRIVED" ||
    phase === "TRIP_ACTIVE" ||
    phase === "TRIP_PAUSED"
  );
}

export type DriverPhase =
  | "RESTORING"
  | "OFFLINE"
  | "GOING_ONLINE"
  | "GOING_OFFLINE"
  | "ONLINE_WAITING"
  | "REQUEST_INCOMING"
  | "REQUEST_ACCEPTING"
  | "REQUEST_UNAVAILABLE"
  | "EN_ROUTE_TO_PICKUP"
  | "ARRIVED_AT_PICKUP"
  | "TRIP_ACTIVE"
  | "TRIP_COMPLETED"
  | "RIDE_CANCELLED";

export function deriveDriverPhase(state: DriverSessionState): DriverPhase {
  const ride = state.ride.ride;
  if (ride) {
    switch (ride.status) {
      case "DRIVER_ASSIGNED":
      case "DRIVER_EN_ROUTE":
      case "DRIVER_ARRIVING":
        return "EN_ROUTE_TO_PICKUP";
      case "DRIVER_ARRIVED":
        return "ARRIVED_AT_PICKUP";
      case "IN_PROGRESS":
      case "PAUSED":
        return "TRIP_ACTIVE";
      case "COMPLETED":
        return "TRIP_COMPLETED";
      case "CANCELLED":
        return "RIDE_CANCELLED";
      default:
        // A driver never sees a ride before assignment.
        break;
    }
  }

  if (state.ride.bootstrap === "idle" || state.ride.bootstrap === "loading") return "RESTORING";

  if (state.offer) {
    if (state.offer.phase === "incoming" || state.offer.phase === "declining") return "REQUEST_INCOMING";
    if (state.offer.phase === "accepting") return "REQUEST_ACCEPTING";
    return "REQUEST_UNAVAILABLE";
  }

  switch (state.availability) {
    case "GOING_ONLINE":
      return "GOING_ONLINE";
    case "GOING_OFFLINE":
      return "GOING_OFFLINE";
    case "ONLINE":
    case "ON_TRIP":
      return "ONLINE_WAITING";
    default:
      return "OFFLINE";
  }
}
