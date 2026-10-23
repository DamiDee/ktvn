import { bookingSchema, type ScheduledRide } from "./contract.ts";
export interface ScheduledEvent { id: string; occurredAt: string; type: string; scheduledRideId?: string; booking?: ScheduledRide }
/** Scheduled seq is always zero. Event IDs, not sequence numbers, deduplicate. */
export function mapScheduledEvent(value: unknown): ScheduledEvent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>, payload = raw.payload as Record<string, unknown> | null;
  if (typeof raw.id !== "string" || !raw.id || typeof raw.occurredAt !== "string" || !Number.isFinite(Date.parse(raw.occurredAt)) || !payload || typeof payload.type !== "string" || !payload.type.startsWith("scheduled.")) return null;
  const booking = bookingSchema.safeParse(payload.booking);
  return { id: raw.id, occurredAt: raw.occurredAt, type: payload.type, scheduledRideId: typeof payload.scheduledRideId === "string" ? payload.scheduledRideId : booking.success ? booking.data.id : undefined, booking: booking.success ? booking.data : undefined };
}
export function scheduledSocketUrl(apiBase: string) {
  const url = new URL(apiBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/rides/ws"; url.search = ""; url.hash = "";
  if (url.username || url.password) throw new Error("Do not put credentials in the WebSocket URL.");
  return url.toString();
}
