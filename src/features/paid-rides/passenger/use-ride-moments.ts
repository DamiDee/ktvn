"use client";

import { useEffect, useRef } from "react";
import { trackRideEvent } from "../analytics";
import { vibrate } from "../capabilities";
import { firstName, formatDuration } from "../domain/format";
import type { PassengerPhase } from "../domain/phases";
import type { Ride } from "../domain/types";
import { notifyRide } from "../notifications/ride-notifications";

/**
 * The emotionally significant transitions — matched, arriving, arrived,
 * started, completed — get a haptic nudge where supported, a background
 * notification if the tab is hidden, and an analytics hook. Each fires once
 * per ride, never on a reload that lands mid-trip.
 */
export function useRideMoments(phase: PassengerPhase, ride: Ride | null): void {
  const previous = useRef<{ phase: PassengerPhase; rideId: string | null } | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = { phase, rideId: ride?.id ?? null };
    // First observation (page load or restore): no celebration.
    if (!before || !ride || before.rideId !== ride.id || before.phase === phase) return;

    const name = ride.driver ? firstName(ride.driver.displayName) : "Your driver";
    switch (phase) {
      case "DRIVER_MATCHED":
      case "DRIVER_EN_ROUTE":
        if (before.phase === "SEARCHING_DRIVERS" || before.phase === "REQUESTING_RIDE") {
          vibrate([30, 40, 30]);
          trackRideEvent("driver_matched");
          void notifyRide("Driver found", `${name} is on the way in a ${ride.driver?.vehicle.color.toLowerCase()} ${ride.driver?.vehicle.model}.`, { tag: `ride-${ride.id}` });
        }
        break;
      case "DRIVER_ARRIVING":
        vibrate(40);
        void notifyRide(`${name} is almost there`, ride.approach ? `About ${formatDuration(ride.approach.etaSeconds)} away.` : "Head to your pickup point.", { tag: `ride-${ride.id}` });
        break;
      case "DRIVER_ARRIVED":
        vibrate([60, 80, 60]);
        void notifyRide(`${name} has arrived`, `Look for ${ride.driver?.vehicle.plate ?? "your car"} at ${ride.pickup.name}.`, { tag: `ride-${ride.id}` });
        break;
      case "TRIP_ACTIVE":
        if (before.phase === "DRIVER_ARRIVED") {
          trackRideEvent("trip_started");
          void notifyRide("Your ride has started", `Heading to ${ride.destination.name}.`, { tag: `ride-${ride.id}` });
        }
        break;
      case "TRIP_COMPLETED":
        vibrate(50);
        trackRideEvent("trip_completed");
        void notifyRide("You've arrived", `Thanks for riding with ${name}.`, { tag: `ride-${ride.id}` });
        break;
      case "CANCELLED_BY_DRIVER":
        vibrate([40, 60, 40]);
        void notifyRide(`${name} cancelled`, "Open K-Rides to find another driver.", { tag: `ride-${ride.id}` });
        break;
      default:
        break;
    }
  }, [phase, ride]);
}
