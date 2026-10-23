import { acceptanceSchema, createSchema, DAY, reasonSchema, timeChangeSchema, validateBookingTime, type CreateScheduledRide, type ScheduledPlace, type ScheduledRide, type ScheduleRole, type ScheduledStatus } from "./contract.ts";
export type { ScheduleRole, ScheduledStatus } from "./contract.ts";
interface DemoMoney { amountMinor: number; currency: string }
interface DemoFare {
  total: DemoMoney; range: { low: DemoMoney; high: DemoMoney };
  breakdown: Array<{ code: string; label: string; amount: DemoMoney }>;
  isEstimate: boolean; waiting: { freeMinutes: number; perMinute: DemoMoney };
}
export interface ScheduledTrip extends ScheduledRide {
  status: ScheduledStatus; fare: DemoFare;
  option: { id: string; name: string | null; vehicleClass: string | null };
  passengerName: string; driverName?: string; acceptedAt?: string; estimateId?: string;
}
export interface ScheduleNotice { id: string; tripId: string; audience: ScheduleRole; message: string; at: string }
export interface DemoEstimate {
  estimateId: string; expiresAt: string; pickup: ScheduledPlace; destination: ScheduledPlace;
  options: Array<{ option: { id: string; name: string; vehicleClass: string; shared: boolean }; available: boolean; fare: DemoFare }>;
}
export interface ScheduleState { trips: ScheduledTrip[]; notices: ScheduleNotice[]; now: number; estimates: DemoEstimate[] }
export const demoId = (id: number) => `10000000-0000-4000-8000-${String(id).padStart(12, "0")}`;
export const DEMO_PASSENGER = demoId(1);
export const DEMO_DRIVERS = [{ id: demoId(2), name: "Demo Driver A" }, { id: demoId(3), name: "Demo Driver B" }];
export const DEMO_PLACES: ScheduledPlace[] = [
  { id: "jabi", name: "Jabi Lake Mall", point: { lat: 9.0721, lng: 7.4246 } },
  { id: "wuse", name: "Wuse Market", point: { lat: 9.0647, lng: 7.4728 } },
  { id: "gwarinpa", name: "Gwarinpa", point: { lat: 9.1088, lng: 7.4045 } },
  { id: "central", name: "Central Area, Abuja", point: { lat: 9.0579, lng: 7.4951 } },
];
export function localScheduleDemo(environment: string | undefined, hostname: string): boolean {
  return environment === "development" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
}
const cash = (amountMinor: number) => ({ amountMinor, currency: "NGN" });
export function demoEstimate(now: number, pickup: ScheduledPlace, destination: ScheduledPlace, estimateId: string): DemoEstimate {
  if (pickup.name === destination.name) throw new Error("Choose different pickup and destination locations.");
  const quote = (total: number): DemoFare => ({ total: cash(total), range: { low: cash(total), high: cash(total) }, breakdown: [{ code: "base", label: "Demo fare", amount: cash(total) }], isEstimate: true, waiting: { freeMinutes: 0, perMinute: cash(0) } });
  return { estimateId, expiresAt: new Date(now + 5 * 60_000).toISOString(), pickup, destination, options: [
    { option: { id: "go", name: "Go", vehicleClass: "sedan", shared: false }, available: false, fare: quote(250_000) },
    { option: { id: "comfort", name: "Comfort", vehicleClass: "sedan", shared: false }, available: true, fare: quote(350_000) },
    { option: { id: "share", name: "Shared", vehicleClass: "sedan", shared: true }, available: true, fare: quote(180_000) },
  ] };
}
function notice(state: ScheduleState, trip: ScheduledTrip, audience: ScheduleRole, message: string): ScheduleNotice {
  return { id: `${trip.id}-${audience}-${state.notices.length}-${state.now}`, tripId: trip.id, audience, message, at: new Date(state.now).toISOString() };
}
function replace(state: ScheduleState, trip: ScheduledTrip, message: string): ScheduleState {
  return { ...state, trips: state.trips.map((entry) => entry.id === trip.id ? trip : entry), notices: [notice(state, trip, "passenger", message), notice(state, trip, "driver", message), ...state.notices].slice(0, 50) };
}
export function createSchedule(state: ScheduleState, input: CreateScheduledRide, bookingId: string): ScheduleState {
  const parsed = createSchema.parse(input);
  const existing = state.trips.find((trip) => trip.estimateId === parsed.estimateId);
  if (existing) {
    if (existing.option.id === parsed.optionId && existing.scheduledAt === new Date(parsed.scheduledAt).toISOString() && existing.timezone === parsed.timezone) return state;
    throw new Error("This estimate already has a different booking. Obtain a fresh estimate.");
  }
  validateBookingTime({ scheduledAt: parsed.scheduledAt, timezone: parsed.timezone }, state.now);
  const estimate = state.estimates.find((entry) => entry.estimateId === parsed.estimateId);
  const selected = estimate?.options.find((entry) => entry.option.id === parsed.optionId);
  if (!estimate || Date.parse(estimate.expiresAt) <= state.now || !selected) throw new Error("The estimate expired. Get a fresh fare quote.");
  if (selected.option.shared) throw new Error("Shared rides cannot be scheduled.");
  const total = { ...selected.fare.total };
  const trip: ScheduledTrip = {
    id: bookingId, passengerId: DEMO_PASSENGER, passengerName: "Demo Passenger", driverId: null, rideId: null,
    status: "OPEN", version: 1, pickup: estimate.pickup, destination: estimate.destination,
    scheduledAt: new Date(parsed.scheduledAt).toISOString(), timezone: parsed.timezone, durationSeconds: 1800, bufferMinutes: 30,
    total, fare: { ...selected.fare, total, isEstimate: false, range: { low: total, high: total }, waiting: { freeMinutes: 0, perMinute: cash(0) } }, fareLocked: true,
    option: { id: selected.option.id, name: selected.option.name, vehicleClass: selected.option.vehicleClass },
    cancellationReason: null, createdAt: new Date(state.now).toISOString(), updatedAt: new Date(state.now).toISOString(), estimateId: parsed.estimateId,
  };
  return { ...state, trips: [trip, ...state.trips], notices: [notice(state, trip, "driver", `New scheduled trip: ${trip.pickup.name} → ${trip.destination.name}`), ...state.notices].slice(0, 50) };
}
export function seedSchedules(now: number): ScheduleState {
  const a = demoEstimate(now, DEMO_PLACES[0], DEMO_PLACES[1], demoId(200));
  const b = demoEstimate(now, DEMO_PLACES[2], DEMO_PLACES[3], demoId(201));
  let state: ScheduleState = { now, trips: [], estimates: [a, b], notices: [] };
  state = createSchedule(state, { estimateId: a.estimateId, optionId: "go", scheduledAt: new Date(now + DAY).toISOString(), timezone: "Africa/Lagos" }, demoId(100));
  state = createSchedule(state, { estimateId: b.estimateId, optionId: "comfort", scheduledAt: new Date(now + 2 * DAY).toISOString(), timezone: "Africa/Lagos" }, demoId(101));
  return acceptSchedule(state, demoId(101), DEMO_DRIVERS[0].id, 1);
}
export function acceptSchedule(state: ScheduleState, tripId: string, driverId: string, version: number): ScheduleState {
  acceptanceSchema.parse({ version });
  const driver = DEMO_DRIVERS.find((entry) => entry.id === driverId), trip = state.trips.find((entry) => entry.id === tripId);
  if (!driver || !trip) throw new Error("That request or driver is unavailable.");
  if (trip.status === "RESERVED" && trip.driverId === driverId) return state;
  if (trip.status !== "OPEN" || trip.version !== version || Date.parse(trip.scheduledAt) <= state.now) throw new Error("This request changed, expired or was accepted. Refresh and review it again.");
  const start = Date.parse(trip.scheduledAt), end = start + trip.durationSeconds * 1000 + trip.bufferMinutes * 60_000;
  const overlaps = state.trips.some((other) => other.id !== tripId && ["RESERVED", "ACTIVATED"].includes(other.status) &&
    (other.passengerId === trip.passengerId || other.driverId === driverId) && start < Date.parse(other.scheduledAt) + other.durationSeconds * 1000 + other.bufferMinutes * 60_000 && end > Date.parse(other.scheduledAt));
  if (overlaps) throw new Error("This reservation conflicts with another journey, including its saved buffer.");
  return replace(state, { ...trip, status: "RESERVED", version: trip.version + 1, driverId, driverName: driver.name, acceptedAt: new Date(state.now).toISOString(), updatedAt: new Date(state.now).toISOString() }, `${driver.name} confirmed the scheduled trip.`);
}
export function rescheduleSchedule(state: ScheduleState, id: string, input: { scheduledAt: string; timezone: string }): ScheduleState {
  timeChangeSchema.parse(input); validateBookingTime(input, state.now);
  const trip = state.trips.find((entry) => entry.id === id);
  if (!trip || !["OPEN", "RESERVED"].includes(trip.status)) throw new Error("Only open or reserved bookings can be rescheduled.");
  return replace(state, { ...trip, ...input, scheduledAt: new Date(input.scheduledAt).toISOString(), status: "OPEN", driverId: null, driverName: undefined, acceptedAt: undefined, version: trip.version + 1, updatedAt: new Date(state.now).toISOString() }, "Pickup time changed. A driver must accept the new time.");
}
export function cancelSchedule(state: ScheduleState, id: string, reason: string): ScheduleState {
  const parsed = reasonSchema.parse({ reason }), trip = state.trips.find((entry) => entry.id === id);
  if (!trip || !["OPEN", "RESERVED"].includes(trip.status)) throw new Error("Use the linked live ride for an activated trip; closed bookings cannot be cancelled here.");
  return replace(state, { ...trip, status: "CANCELLED", cancellationReason: parsed.reason, version: trip.version + 1, updatedAt: new Date(state.now).toISOString() }, "Scheduled trip cancelled.");
}
export function releaseSchedule(state: ScheduleState, id: string, driverId: string, reason: string): ScheduleState {
  const parsed = reasonSchema.parse({ reason }), trip = state.trips.find((entry) => entry.id === id);
  if (!trip || trip.driverId !== driverId || trip.status !== "RESERVED") throw new Error("Only the assigned driver can release a reserved trip. Use the live ride after activation.");
  const status = Date.parse(trip.scheduledAt) <= state.now ? "EXPIRED" : "OPEN";
  return replace(state, { ...trip, status, driverId: null, driverName: undefined, acceptedAt: undefined, cancellationReason: parsed.reason, version: trip.version + 1, updatedAt: new Date(state.now).toISOString() }, status === "OPEN" ? "Driver released the reservation. Finding another driver." : "The released booking expired.");
}
/** Explicit local worker simulation. Live screens never derive status from their clock. */
export function matchDueSchedules(state: ScheduleState, now: number, busy = false): ScheduleState {
  if (!Number.isFinite(now) || now < state.now) throw new Error("The simulation clock cannot move backwards.");
  let next = { ...state, now };
  for (const trip of state.trips) {
    const at = Date.parse(trip.scheduledAt);
    if (trip.status === "OPEN" && now >= at || trip.status === "RESERVED" && now > at + 10 * 60_000) {
      next = replace(next, { ...trip, status: "EXPIRED", version: trip.version + 1, updatedAt: new Date(now).toISOString() }, "No ride is available for this scheduled trip.");
    } else if (trip.status === "RESERVED" && now >= at - 15 * 60_000 && !busy) {
      next = replace(next, { ...trip, status: "ACTIVATED", rideId: trip.id.replace(/^10000000/, "20000000"), version: trip.version + 1, updatedAt: new Date(now).toISOString() }, "Ride ready. Open the linked live ride.");
    }
  }
  return next;
}
export function completeDemoSchedule(state: ScheduleState, id: string): ScheduleState {
  const trip = state.trips.find((entry) => entry.id === id);
  if (!trip || trip.status !== "ACTIVATED") throw new Error("Activate the demo ride before completing it.");
  return replace(state, { ...trip, status: "COMPLETED", version: trip.version + 1, updatedAt: new Date(state.now).toISOString() }, "Scheduled ride completed.");
}
