import type { ApiBooking, ApiBus } from "../types/freebus-api";

export function isOversight(role: string) { return role === "Admin" || role === "Root"; }
export function activeBooking(booking: ApiBooking) {
  return booking.status === "Confirmed" || booking.status === "Boarded";
}
export function busCanBoard(bus: ApiBus) {
  return bus.status !== "Maintenance" && (bus.state === "Boarding" || bus.state === "Stationary");
}
export function availableCapacity(bus: ApiBus) {
  return busCanBoard(bus) ? Math.max(0, bus.capacity - bus.current_passenger_count) : 0;
}
export function queryString(filters: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query.size ? `?${query}` : "";
}

/**
 * Which screens a role may open. This shapes the interface only — the browser now calls
 * the API directly, so every role and ownership rule is enforced by the API itself.
 */
export function canAdminister(role: string) { return isOversight(role); }
export function canBook(role: string) { return role === "User"; }
export function canBoard(role: string) { return isOversight(role) || role === "RouteCoordinator"; }
export function liveHome(role: string) { return role === "RouteCoordinator" ? "/admin/free-buses/boarding" : isOversight(role) ? "/admin/free-buses" : "/passenger/free-buses"; }
