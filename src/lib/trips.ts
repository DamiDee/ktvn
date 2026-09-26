import type { ApiRoute, ApiTrip } from "../types/freebus-api";

export function apiTimestamp(value: string) {
  if (!value) return "";
  const iso = value.trim().replace(" ", "T");
  return /(?:Z|[+-]\d\d:\d\d)$/i.test(iso) ? iso : `${iso}Z`;
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
/**
 * A trip is bookable when it belongs to this route, is free, has not started, and
 * has not already left. Travel is offered on any day of the week.
 */
export function tripCanBook(trip: ApiTrip, route: ApiRoute, now = Date.now()) {
  if (trip.route_id !== route.id) return false;
  if (Number(route.fare ?? 0) !== 0) return false;
  if ((trip.status || "").toLowerCase().replace(/_/g, "") !== "notstarted") return false;
  const departure = Date.parse(apiTimestamp(trip.departure_time));
  return Number.isFinite(departure) && departure > now;
}
export type ScheduledJourney = ApiRoute & { route_id: string; departure_date: string; departure_time: string; ride_type: ApiTrip["ride_type"]; is_completed: boolean; trip: ApiTrip };

export function extractArray<T>(input: unknown): T[] {
  if (Array.isArray(input)) return input as T[];
  if (input && typeof input === "object" && "data" in input && Array.isArray((input as { data: unknown }).data)) {
    return (input as { data: T[] }).data;
  }
  return [];
}

export function scheduledJourneys(routesInput: unknown, tripsInput: unknown): ScheduledJourney[] {
  const routes = extractArray<ApiRoute>(routesInput);
  const trips = extractArray<ApiTrip>(tripsInput);
  const byId = new Map(routes.map((r) => [r.id, r]));
  return trips.flatMap((trip) => {
    // A trip whose route has been deleted has no boarding point to show, so it is
    // not offered. The route list is the source of truth for what can be travelled.
    const route = byId.get(trip.route_id);
    if (!route) return [];
    const when = watParts(trip.departure_time);
    const statusNorm = (trip.status || "").toLowerCase();
    return [{
      ...route,
      id: trip.id,
      route_id: route.id,
      departure_date: when.date || "Upcoming",
      departure_time: when.time || "00:00:00",
      ride_type: trip.ride_type || "Pickup",
      is_completed: ["completed", "cancelled"].includes(statusNorm),
      trip,
    }];
  });
}
