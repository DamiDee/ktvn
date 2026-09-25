import type { ApiBooking, ApiBus, ApiRoute } from "../types/freebus-api";
export interface BookingVerification { valid: boolean; message: string; booking_id?: string | null; status?: ApiBooking["status"] | null; payment_status?: ApiBooking["payment_status"] | null; seat_number?: number | null; booking_ref?: string | null }
export interface BookingQr { booking_id: string; booking_ref: string; qr_code_base64: string }

/** A scan never trusts its own embedded status, identity, or bus assignment. */
export function boardingProblem(booking: ApiBooking, bus: ApiBus, route: ApiRoute) {
  if (booking.bus_id !== bus.id || booking.route_id !== bus.current_route_id || route.id !== booking.route_id) return "This pass belongs to a different bus or route.";
  if (booking.status === "Boarded") return "This passenger has already boarded.";
  if (booking.status !== "Confirmed") return `This booking is ${booking.status.toLowerCase()}; do not board.`;
  if (booking.payment_status !== "Free" && booking.payment_status !== "Paid") return "This booking is not cleared for boarding.";
  if (route.is_completed || bus.status === "Maintenance" || !["Boarding", "Stationary"].includes(bus.state)) return "This bus or route is not open for boarding.";
  return null;
}

export function qrImageSource(base64: string) {
  // Render only PNG data, never arbitrary URLs or SVG/HTML returned as ticket content.
  const raw = base64.replace(/^data:image\/png;base64,/, "").replace(/\s/g, "");
  return raw.startsWith("iVBORw0KGgo") && /^[A-Za-z0-9+/=]+$/.test(raw) ? `data:image/png;base64,${raw}` : null;
}
