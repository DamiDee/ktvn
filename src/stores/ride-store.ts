"use client";

import { create } from "zustand";
import {
  DriverTrack,
  PaymentStatus,
  RideStatus,
  RideType,
  SOSStatus,
} from "@/types/enums";
import {
  canTransitionRide,
  canTransitionSos,
} from "@/lib/state-machines";
import type {
  Driver,
  FareQuoteLike,
  PickupZone,
  RideLocation,
  RoutePath,
} from "@/types/models";

/**
 * The passenger's live ride.
 *
 * Status changes go through `transition()`, which refuses moves the ride state
 * machine doesn't allow. Nothing in the UI sets `status` directly, so an
 * illegal jump (say SEARCHING straight to COMPLETED) can't happen from a
 * mis-wired button.
 */

export interface RideDraft {
  track: DriverTrack;
  rideType: RideType;
  pickup: RideLocation | null;
  destination: RideLocation | null;
  pickupZone: PickupZone | null;
  departurePlan: "NOW" | "AFTER_EVENT";
}

interface RideState extends RideDraft {
  status: RideStatus;
  sosStatus: SOSStatus;

  /** Populated once an estimate comes back. */
  route: RoutePath | null;
  /** Professional track only — stays null on the volunteer track. */
  fare: FareQuoteLike | null;

  driver: Driver | null;
  etaMinutes: number | null;
  /** 0–1 progress of the driver along the current leg. */
  progress: number;

  sharingActive: boolean;
  /** Passenger gives this to the confirmed driver before the trip starts. */
  boardingPin: string;
  /** Set when the last transition was refused, for dev visibility. */
  lastRefusedTransition: string | null;

  setTrack: (track: DriverTrack) => void;
  setRideType: (rideType: RideType) => void;
  setPickup: (pickup: RideLocation | null) => void;
  setDestination: (destination: RideLocation | null) => void;
  setPickupZone: (zone: PickupZone | null) => void;
  setDeparturePlan: (plan: RideDraft["departurePlan"]) => void;
  setEstimate: (route: RoutePath | null, fare: FareQuoteLike | null) => void;

  transition: (next: RideStatus) => boolean;
  setDriver: (driver: Driver | null) => void;
  setEta: (minutes: number | null) => void;
  setProgress: (progress: number) => void;

  transitionSos: (next: SOSStatus) => boolean;
  setSharing: (active: boolean) => void;

  reset: () => void;
}

const INITIAL: Omit<
  RideState,
  | "setTrack"
  | "setRideType"
  | "setPickup"
  | "setDestination"
  | "setPickupZone"
  | "setDeparturePlan"
  | "setEstimate"
  | "transition"
  | "setDriver"
  | "setEta"
  | "setProgress"
  | "transitionSos"
  | "setSharing"
  | "reset"
> = {
  track: DriverTrack.VOLUNTEER,
  rideType: RideType.PRIVATE,
  pickup: null,
  destination: null,
  pickupZone: null,
  departurePlan: "AFTER_EVENT",
  status: RideStatus.IDLE,
  sosStatus: SOSStatus.INACTIVE,
  route: null,
  fare: null,
  driver: null,
  etaMinutes: null,
  progress: 0,
  sharingActive: false,
  boardingPin: "4821",
  lastRefusedTransition: null,
};

export const useRideStore = create<RideState>((set, get) => ({
  ...INITIAL,

  setTrack: (track) =>
    set(() => ({
      track,
      // Product Rule 1: leaving the professional track drops the fare entirely,
      // so there is no stale amount to render on a volunteer ride.
      fare: track === DriverTrack.VOLUNTEER ? null : get().fare,
    })),

  setRideType: (rideType) => set({ rideType }),
  setPickup: (pickup) => set({ pickup }),
  setDestination: (destination) => set({ destination }),
  setPickupZone: (pickupZone) =>
    set({ pickupZone, pickup: pickupZone?.location ?? null }),
  setDeparturePlan: (departurePlan) => set({ departurePlan }),
  setEstimate: (route, fare) => set({ route, fare }),

  transition: (next) => {
    const current = get().status;
    if (current === next) return true;

    if (!canTransitionRide(current, next)) {
      set({ lastRefusedTransition: `${current} → ${next}` });
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[ride-store] refused illegal transition ${current} → ${next}`,
        );
      }
      return false;
    }

    set({ status: next, lastRefusedTransition: null });
    return true;
  },

  setDriver: (driver) => set({ driver }),
  setEta: (etaMinutes) => set({ etaMinutes }),
  setProgress: (progress) => set({ progress }),

  transitionSos: (next) => {
    const current = get().sosStatus;
    if (current === next) return true;

    if (!canTransitionSos(current, next)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[ride-store] refused illegal SOS ${current} → ${next}`);
      }
      return false;
    }

    set({ sosStatus: next });
    return true;
  },

  setSharing: (sharingActive) => set({ sharingActive }),

  reset: () => set({ ...INITIAL }),
}));

/** Payment status implied by the current ride — volunteer is never applicable. */
export function paymentStatusForRide(
  track: DriverTrack,
  fare: FareQuoteLike | null,
): PaymentStatus {
  if (track === DriverTrack.VOLUNTEER) return PaymentStatus.NOT_APPLICABLE;
  return fare ? PaymentStatus.FARE_READY : PaymentStatus.FARE_LOADING;
}
