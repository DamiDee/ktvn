import { PAID_RIDES_CONFIG } from "../config.ts";
import type { DriverSessionState } from "../domain/driver-session.ts";
import { isLive } from "../domain/ride-status.ts";
import type { DeviceFix } from "../location/location-store";
import type { TrackerFrame } from "./trip-canvas";

export function driverTrackerFrame(state: DriverSessionState, fix: DeviceFix | null, now: number): TrackerFrame | null {
  const ride = state.ride.ride;
  const live = ride && isLive(ride.status);
  if (!live && !["ONLINE", "ON_TRIP", "GOING_OFFLINE"].includes(state.availability)) return null;
  const onTrip = ride?.status === "IN_PROGRESS" || ride?.status === "PAUSED";
  const stale = !fix || now === 0 || now - fix.timestamp > PAID_RIDES_CONFIG.location.maxFixAgeMs;
  const target = live ? (onTrip ? ride.destination : ride.pickup) : null;
  return {
    route: live ? (onTrip ? ride.route.points : ride.approach?.route?.points ?? []) : [],
    vehicle: fix?.point ?? null,
    heading: fix?.heading ?? null,
    target: target?.point ?? null,
    targetKind: onTrip ? "destination" : "pickup",
    etaValue: stale ? "GPS?" : "GPS",
    etaUnit: "",
    status: state.ride.connection !== "open" ? "Reconnecting — return to K-Rides" : stale ? "Location paused — return to K-Rides" : state.offer?.phase === "incoming" ? "New request — open K-Rides" : target ? `To ${target.name}` : "Waiting for requests",
    detail: fix ? `GPS at ${new Date(fix.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Waiting for GPS",
    dark: false,
  };
}
