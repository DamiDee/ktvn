import { z } from "zod";

export const scheduledStatuses = ["OPEN", "RESERVED", "ACTIVATED", "COMPLETED", "CANCELLED", "EXPIRED"] as const;
export type ScheduledStatus = typeof scheduledStatuses[number];
export type ScheduleRole = "passenger" | "driver" | "admin";
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const uuid = z.string().uuid();
const instant = z.string().refine((v) => /(?:Z|[+-]\d{2}:\d{2})$/i.test(v) && Number.isFinite(Date.parse(v)), "Include a valid date and UTC offset.");
export function validTimezone(value: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return value.length > 0; } catch { return false; }
}
const timezone = z.string().refine(validTimezone, "Choose a recognized IANA timezone.");
const money = z.object({ amountMinor: z.number().int().nonnegative(), currency: z.string().min(1) });
// Null metadata means no value; the shared route display uses undefined for it.
const placeText = z.string().nullable().transform((value) => value ?? undefined).optional();
const place = z.object({ id: placeText, name: z.string().min(1), secondary: placeText, point: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }), source: placeText });
// These two required payloads are deliberately unstructured in OpenAPI.
const opaquePayload = z.unknown().refine((value) => value !== undefined, "Missing booking payload.");
export function scheduledOptionName(option: unknown): string {
  if (option && typeof option === "object" && "name" in option && typeof option.name === "string" && option.name.trim()) return option.name;
  return "Private ride";
}
export const bookingSchema = z.object({
  // OpenAPI permits these nullable references to be omitted, even in later states.
  id: uuid, passengerId: uuid, driverId: uuid.nullable().default(null), rideId: uuid.nullable().default(null), status: z.string().min(1), version: z.number().int().nonnegative(),
  pickup: place, destination: place, scheduledAt: instant, timezone, durationSeconds: z.number().nonnegative(), bufferMinutes: z.number().nonnegative(),
  total: money, fare: opaquePayload, fareLocked: z.boolean(), option: opaquePayload,
  cancellationReason: z.string().nullable().default(null), createdAt: instant, updatedAt: instant,
});
export type ScheduledRide = z.infer<typeof bookingSchema>;
export type ScheduledPlace = ScheduledRide["pickup"];
export const pageSchema = z.object({ items: z.array(bookingSchema), nextCursor: uuid.nullable().default(null), total: z.number().int().nonnegative() });
export type ScheduledRidePage = z.infer<typeof pageSchema>;
export const createSchema = z.object({ estimateId: uuid, optionId: z.string().min(1), scheduledAt: instant, timezone }).strict();
export type CreateScheduledRide = z.infer<typeof createSchema>;
export const timeChangeSchema = z.object({ scheduledAt: instant, timezone }).strict();
export const reasonSchema = z.object({ reason: z.string().trim().min(1, "Give a reason.").refine((text) => new TextEncoder().encode(text).length <= 2000, "Use no more than 2,000 UTF-8 bytes.") }).strict();
export const assignmentSchema = z.object({ driverId: uuid, version: z.number().int().nonnegative() }).strict();
export const acceptanceSchema = z.object({ version: z.number().int().nonnegative() }).strict();
export const listSchema = z.object({ cursor: uuid.optional(), limit: z.number().int().min(1).max(100).optional(), status: z.enum(scheduledStatuses).optional(), from: instant.optional(), to: instant.optional(), mine: z.boolean().optional() }).strict();
export type ScheduleListQuery = z.infer<typeof listSchema>;
export function validateBookingTime(value: { scheduledAt: string; timezone: string }, now: number) {
  timeChangeSchema.parse(value);
  const at = Date.parse(value.scheduledAt);
  if (at < now + HOUR || at > now + 30 * DAY) throw new Error("Choose pickup between one hour and thirty days from now.");
}
function parts(at: number, timezone: string) {
  const all = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(at);
  return Object.fromEntries(all.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
}
export function localScheduleTime(at: string | number, timezone = "Africa/Lagos"): string {
  const p = parts(typeof at === "number" ? at : Date.parse(at), timezone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
/** Resolve wall time in the selected zone, rejecting DST gaps and ambiguous repeats. */
export function resolveScheduleTime(local: string, timezone: string): string {
  if (!validTimezone(timezone) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error("Choose a valid pickup time and timezone.");
  const wall = Date.parse(`${local}:00Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 16) !== local) throw new Error("Choose a valid calendar date.");
  const offsets = new Set<number>();
  for (const delta of [-36, -12, 0, 12, 36]) {
    const at = wall + delta * HOUR, p = parts(at, timezone);
    offsets.add(Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`) - at);
  }
  const matches = [...offsets].map((offset) => wall - offset).filter((at) => localScheduleTime(at, timezone) === local);
  if (matches.length !== 1) throw new Error("That local time is skipped or repeated by daylight saving. Choose another pickup time.");
  return new Date(matches[0]).toISOString();
}
export function preferNewerBooking(old: ScheduledRide | undefined, next: ScheduledRide): ScheduledRide {
  return old?.id === next.id && old.version >= next.version ? old : next;
}
export function scheduleListSearch(query: ScheduleListQuery, driver: boolean): string {
  const parsed = listSchema.parse(query), params = new URLSearchParams();
  if (parsed.from && parsed.to && Date.parse(parsed.from) >= Date.parse(parsed.to)) throw new Error("Choose an end time after the start time.");
  for (const [key, value] of Object.entries(parsed)) if (value !== undefined && (driver || key !== "mine")) params.set(key, String(value));
  return params.size ? `?${params}` : "";
}
