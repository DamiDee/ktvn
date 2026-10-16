import type { ApiBooking, ApiBus, ApiTrip } from "../types/freebus-api";
export interface BookingVerification { valid: boolean; message: string; booking_id?: string | null; status?: ApiBooking["status"] | null; payment_status?: ApiBooking["payment_status"] | null; seat_number?: number | null; booking_ref?: string | null }
export interface BookingQr { booking_id: string; booking_ref: string; qr_code_base64: string }

/** Existing passengers may join at later stops while their assigned trip runs. */
export function bookingBoardingOpen(booking: ApiBooking, trip?: ApiTrip) {
  if (!trip || booking.trip_id !== trip.id || booking.route_id !== trip.route_id || booking.status !== "Confirmed") return false;
  // Completed is terminal: the API has no per-leg completion state. Never infer
  // that a completed trip is only halfway finished from its scheduled times.
  return trip.status === "NotStarted" || trip.status === "InProgress";
}

/** A scan never trusts its own embedded status, identity, or bus assignment. */
export function boardingProblem(booking: ApiBooking, bus: ApiBus, trip: ApiTrip) {
  if (booking.bus_id !== bus.id || !booking.trip_id || booking.trip_id !== bus.current_trip_id || trip.id !== booking.trip_id || trip.route_id !== booking.route_id) return "This pass belongs to a different bus or trip.";
  if (booking.status === "Boarded") return "This passenger has already boarded.";
  if (booking.status !== "Confirmed") return `This booking is ${booking.status.toLowerCase()}; do not board.`;
  if (booking.payment_status !== "Free" && booking.payment_status !== "Paid") return "This booking is not cleared for boarding.";
  if (!bookingBoardingOpen(booking, trip) || bus.status === "Maintenance") return "This bus or trip is not open for boarding.";
  // Transit/Arrived describe progress along the route; they do not close pickup
  // at intermediate stops or the return leg of an in-progress round trip.
  if (trip.status === "NotStarted" && !["Boarding", "Stationary"].includes(bus.state)) return "This bus is not ready for boarding.";
  return null;
}

export function qrImageSource(base64: string) {
  // Render only PNG data, never arbitrary URLs or SVG/HTML returned as ticket content.
  const raw = base64.replace(/^data:image\/png;base64,/, "").replace(/\s/g, "");
  return raw.startsWith("iVBORw0KGgo") && /^[A-Za-z0-9+/=]+$/.test(raw) ? `data:image/png;base64,${raw}` : null;
}
