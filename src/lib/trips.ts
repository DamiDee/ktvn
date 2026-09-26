import type { ApiRoute, ApiTrip } from "../types/freebus-api";

/** UI policy; the API must enforce the same rule. Bookings can be made on any day. */
export const SUNDAY_TRAVEL_ONLY = process.env.NEXT_PUBLIC_FREEBUS_SUNDAY_ONLY !== "false";
export function apiTimestamp(value: string) {
  // OpenAPI date-time is RFC3339; tolerate the backend's older timezone-free UTC values.
  return /(?:Z|[+-]\d\d:\d\d)$/i.test(value) ? value : `${value}Z`;
}

/**
 * The deployed trip parser rejects timezone suffixes, despite OpenAPI's date-time
 * format. Convert the WAT form value to UTC first, then send a naive UTC timestamp
 * (the inverse of apiTimestamp). Never just remove +01:00: that shifts the journey.
 */
export function watInputToApiTime(value: string): string | null {
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2})(\.\d{1,3})?)?$/.exec(value);
  if (!parts) return null;
  const normalized = `${parts[1]}T${parts[2]}:${parts[3] ?? "00"}.${(parts[4]?.slice(1) ?? "").padEnd(3, "0")}`;
  // Parse as UTC wall time solely to validate without depending on the device TZ.
  const wallTime = Date.parse(`${normalized}Z`);
  if (!Number.isFinite(wallTime) || new Date(wallTime).toISOString() !== `${normalized}Z`) return null;
  return new Date(wallTime - 3_600_000).toISOString().replace(/(?:\.000)?Z$/, "");
}

export function watParts(value: string) {
  const time = Date.parse(apiTimestamp(value));
  if (!Number.isFinite(time)) return { date: "", time: "", sunday: false };
  const local = new Date(time + 3600000);
  return { date: local.toISOString().slice(0, 10), time: local.toISOString().slice(11, 19), sunday: local.getUTCDay() === 0 };
}
export function tripCanBook(trip: ApiTrip, route: ApiRoute, now = Date.now(), sundayOnly = SUNDAY_TRAVEL_ONLY) {
  return route.id === trip.route_id && route.fare === 0 && trip.status === "NotStarted" && Date.parse(apiTimestamp(trip.departure_time)) > now && (!sundayOnly || watParts(trip.departure_time).sunday);
}
export type ScheduledJourney = ApiRoute & { route_id: string; departure_date: string; departure_time: string; ride_type: ApiTrip["ride_type"]; is_completed: boolean; trip: ApiTrip };
export function scheduledJourneys(routes: ApiRoute[], trips: ApiTrip[]): ScheduledJourney[] {
  const byId = new Map(routes.map((r) => [r.id, r]));
  return trips.flatMap((trip) => {
    const route = byId.get(trip.route_id);
    if (!route) return [];
    const when = watParts(trip.departure_time);
    return [{ ...route, id: trip.id, route_id: route.id, departure_date: when.date, departure_time: when.time, ride_type: trip.ride_type, is_completed: ["Completed", "Cancelled"].includes(trip.status), trip }];
  });
}
