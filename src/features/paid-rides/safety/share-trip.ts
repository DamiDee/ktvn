"use client";

import { formatArrivalClock, firstName } from "../domain/format";
import type { Ride } from "../domain/types";
import { getRideService } from "../services";
import { getRideCapabilities } from "../capabilities";

/**
 * Share-trip: Web Share where supported, clipboard otherwise. The message
 * carries only what a trusted contact needs — driver first name, vehicle,
 * plate, destination and ETA — plus the server-issued live link when one
 * exists. Never the rider's phone number or exact pickup coordinates.
 */

export function buildShareText(ride: Ride, link: string | null): string {
  const lines = ["I'm on a K-Rides trip."];
  if (ride.driver) {
    const v = ride.driver.vehicle;
    lines.push(`Driver: ${firstName(ride.driver.displayName)} · ${v.color} ${v.make} ${v.model} · ${v.plate}`);
  }
  lines.push(`Going to: ${ride.destination.name}`);
  const eta = ride.progress?.etaSeconds ?? (ride.approach ? ride.approach.etaSeconds + ride.route.durationSeconds : null);
  if (eta !== null && eta !== undefined) lines.push(`Expected around ${formatArrivalClock(eta)}`);
  if (link) lines.push(`Follow live: ${link}`);
  return lines.join("\n");
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

export async function shareTrip(ride: Ride): Promise<ShareOutcome> {
  const link = ride.shareUrl ?? (await getRideService().getShareLink(ride.id).catch(() => null));
  const text = buildShareText(ride, link);
  const capabilities = getRideCapabilities();

  if (capabilities.webShare) {
    try {
      await navigator.share({ title: "My K-Rides trip", text });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Fall through to the clipboard.
    }
  }
  if (capabilities.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}
