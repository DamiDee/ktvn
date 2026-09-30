import type { ApiBus, ApiRoute, ApiTrip } from "../types/freebus-api";

export function journeyTypeLabel(type?: string | null) {
  return type === "Pickup" ? "To church" : type === "Dropoff" ? "To home" : type === "RoundTrip" ? "Round trip" : "Journey type unavailable";
}

/** Preserve the published stop order, without listing the terminals twice. */
export function routePointIds(route: ApiRoute): string[] {
  return [route.start_point, ...route.stops.filter((id) => id !== route.start_point && id !== route.end_point), route.end_point].filter(Boolean);
}

/** The allocation endpoint takes an absolute count, not an atomic increment. */
export function walkInAllocation(bus: ApiBus, trip: ApiTrip, additional: number) {
  if (!bus.current_trip_id || trip.id !== bus.current_trip_id) throw new Error("This bus has no matching trip. Ask an admin to assign it first.");
  if (trip.status !== "NotStarted" || bus.status === "Maintenance" || !["Stationary", "Boarding"].includes(bus.state)) throw new Error("This bus is not open for boarding.");
  if (!Number.isSafeInteger(additional) || additional < 1) throw new Error("Enter a whole number of passengers, at least 1.");
  if (!Number.isSafeInteger(bus.current_passenger_count) || bus.current_passenger_count < 0 || !Number.isSafeInteger(bus.capacity)) throw new Error("The bus occupancy is unavailable. Refresh before boarding.");
  const passenger_count = bus.current_passenger_count + additional;
  if (passenger_count > bus.capacity) throw new Error(`Only ${Math.max(0, bus.capacity - bus.current_passenger_count)} spaces remain.`);
  return { passenger_count };
}
