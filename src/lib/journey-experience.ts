import type { ApiBooking, ApiBus, ApiRoute, ApiTrip, CreateBookingDto } from "../types/freebus-api";

export function journeyTypeLabel(type?: string | null) {
  return type === "Pickup" ? "To church" : type === "Dropoff" ? "To home" : type === "RoundTrip" ? "Round trip" : "Journey type unavailable";
}

/** Preserve the published stop order, without listing the terminals twice. */
export function routePointIds(route: ApiRoute): string[] {
  return [...new Set([route.start_point, ...(route.stops ?? []).filter((id) => id !== route.start_point && id !== route.end_point), route.end_point].filter(Boolean))];
}

/** Both terminals and intermediate stops may be chosen, in the published direction. */
export function bookingPointsValid(route: ApiRoute, pickup: string, dropoff: string) {
  const points = routePointIds(route);
  return Boolean(pickup && dropoff) && points.indexOf(pickup) >= 0 && points.indexOf(dropoff) > points.indexOf(pickup);
}

export function assignedBookingBuses(trip: ApiTrip, buses: ApiBus[]) {
  return buses.filter((bus) => (bus.current_trip_id === trip.id || (bus.id === trip.bus_id && !bus.current_trip_id)) &&
    bus.status !== "Maintenance" && ["Stationary", "Boarding"].includes(bus.state));
}

/** The most children one booking may bring along. */
export const MAX_KIDS = 5;

/** People who hold a seat on each trip: every active booking is the member plus their children. */
export function tripBookingSummary(bookings: ApiBooking[]) {
  const summary = new Map<string, { bookings: number; people: number; boarded: number }>();
  for (const booking of bookings) {
    if (!booking.trip_id || (booking.status !== "Confirmed" && booking.status !== "Boarded")) continue;
    const entry = summary.get(booking.trip_id) ?? { bookings: 0, people: 0, boarded: 0 };
    const party = 1 + (booking.num_of_kids ?? 0);
    entry.bookings += 1; entry.people += party;
    if (booking.status === "Boarded") entry.boarded += party;
    summary.set(booking.trip_id, entry);
  }
  return summary;
}

export function bookingPayload(trip: ApiTrip, route: ApiRoute, bus: ApiBus, pickup: string, dropoff: string, kids: number, returning: boolean): CreateBookingDto {
  if (trip.route_id !== route.id || !bookingPointsValid(route, pickup, dropoff)) throw new Error("Choose a pickup point and a later drop-off on this route.");
  if (!Number.isSafeInteger(kids) || kids < 0 || kids > MAX_KIDS) throw new Error(`Choose between 0 and ${MAX_KIDS} children.`);
  if (!Number.isSafeInteger(bus.capacity) || !Number.isSafeInteger(bus.current_passenger_count) || bus.current_passenger_count < 0 || !assignedBookingBuses(trip, [bus]).length || bus.capacity - bus.current_passenger_count < 1 + kids) throw new Error("There are not enough seats on an assigned bus for your party.");
  if (returning && (!trip.return_time || trip.ride_type === "Dropoff")) throw new Error("A return journey has not been scheduled for this departure.");
  return { bus_id: bus.id, route_id: route.id, trip_id: trip.id, pickup_point: pickup, dropoff_point: dropoff, num_of_kids: kids, return_trip: returning };
}

/** Label an actual server booking, never create a second pass from the first QR. */
export function bookingLeg(booking: ApiBooking, trip?: ApiTrip, route?: ApiRoute): "outbound" | "return" | "unknown" {
  if (trip?.ride_type === "Dropoff") return "return";
  if ((trip?.ride_type === "RoundTrip" || trip?.return_time) && route && booking.pickup_point && booking.dropoff_point) {
    const points = routePointIds(route);
    const from = points.indexOf(booking.pickup_point), to = points.indexOf(booking.dropoff_point);
    if (from >= 0 && to >= 0 && from !== to) return from < to ? "outbound" : "return";
  }
  if (trip?.ride_type === "Pickup") return "outbound";
  return "unknown";
}

export function bookingLegLabel(booking: ApiBooking, trip?: ApiTrip, route?: ApiRoute) {
  const leg = bookingLeg(booking, trip, route);
  return leg === "outbound" ? "To church · Outbound pass" : leg === "return" ? "To home · Return pass" : journeyTypeLabel(trip?.ride_type);
}

export function bookingDeparture(booking: ApiBooking, trip?: ApiTrip, route?: ApiRoute) {
  if (!trip) return null;
  if (trip.ride_type === "Dropoff") return trip.departure_time;
  if (trip.ride_type === "RoundTrip" || trip.return_time) {
    const leg = bookingLeg(booking, trip, route);
    if (leg === "unknown") return null;
    if (leg === "return") return trip.return_time ?? null;
  }
  return trip.departure_time;
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
