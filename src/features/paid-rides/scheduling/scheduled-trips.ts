export type ScheduleRole = "passenger" | "driver" | "admin";
export type ScheduledStatus = "OPEN" | "RESERVED" | "MATCHED" | "CANCELLED";
export interface ScheduledTrip {
  id: string;
  passengerName: string;
  pickup: string;
  destination: string;
  departureAt: string;
  createdAt: string;
  status: ScheduledStatus;
  driverId?: string;
  driverName?: string;
  acceptedAt?: string;
  matchedAt?: string;
}
export interface ScheduleNotice {
  id: string;
  tripId: string;
  audience: ScheduleRole;
  message: string;
  at: string;
}
export interface ScheduleState { trips: ScheduledTrip[]; notices: ScheduleNotice[]; now: number }
export const DEMO_DRIVERS = [{ id: "demo-driver-a", name: "Demo Driver A" }, { id: "demo-driver-b", name: "Demo Driver B" }];
export function localScheduleDemo(environment: string | undefined, hostname: string): boolean {
  return environment === "development" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
}
export function seedSchedules(now: number): ScheduleState {
  const iso = (offset: number) => new Date(now + offset).toISOString();
  return { now, trips: [
    { id: "demo-schedule-1", passengerName: "Demo Passenger", pickup: "Jabi Lake Mall", destination: "Wuse Market", departureAt: iso(86_400_000), createdAt: iso(-3_600_000), status: "OPEN" },
    { id: "demo-schedule-2", passengerName: "Demo Passenger", pickup: "Gwarinpa", destination: "Central Area, Abuja", departureAt: iso(172_800_000), createdAt: iso(-7_200_000), status: "RESERVED", driverId: DEMO_DRIVERS[0].id, driverName: DEMO_DRIVERS[0].name, acceptedAt: iso(-3_600_000) },
  ], notices: [{ id: "demo-notice-1", tripId: "demo-schedule-1", audience: "driver", message: "New scheduled trip: Jabi Lake Mall → Wuse Market", at: iso(-3_600_000) }] };
}
function notice(state: ScheduleState, trip: ScheduledTrip, audience: ScheduleRole, message: string): ScheduleNotice {
  return { id: `${trip.id}-${audience}-${state.notices.length}-${state.now}`, tripId: trip.id, audience, message, at: new Date(state.now).toISOString() };
}
export function createSchedule(state: ScheduleState, input: { id: string; pickup: string; destination: string; departureAt: string }): ScheduleState {
  const pickup = input.pickup.trim(), destination = input.destination.trim();
  const departure = Date.parse(input.departureAt);
  if (!pickup || !destination || pickup.length > 200 || destination.length > 200 || pickup.toLowerCase() === destination.toLowerCase()) throw new Error("Choose different pickup and destination locations.");
  if (!Number.isFinite(departure) || departure <= state.now) throw new Error("Choose a departure time in the future.");
  if (!input.id || state.trips.some((trip) => trip.id === input.id)) throw new Error("This schedule already exists.");
  const trip: ScheduledTrip = { id: input.id, passengerName: "Demo Passenger", pickup, destination, departureAt: new Date(departure).toISOString(), createdAt: new Date(state.now).toISOString(), status: "OPEN" };
  return { ...state, trips: [trip, ...state.trips], notices: [notice(state, trip, "driver", `New scheduled trip: ${pickup} → ${destination}`), ...state.notices].slice(0, 50) };
}
export function acceptSchedule(state: ScheduleState, tripId: string, driverId: string): ScheduleState {
  const driver = DEMO_DRIVERS.find((entry) => entry.id === driverId);
  const trip = state.trips.find((entry) => entry.id === tripId);
  if (!driver || !trip) throw new Error("That scheduled trip or driver is unavailable.");
  if (trip.status !== "OPEN") throw new Error("Another driver has already accepted this trip, or it is no longer available.");
  const updated: ScheduledTrip = { ...trip, status: "RESERVED", driverId: driver.id, driverName: driver.name, acceptedAt: new Date(state.now).toISOString() };
  return { ...state, trips: state.trips.map((entry) => entry.id === tripId ? updated : entry), notices: [notice(state, updated, "passenger", `${driver.name} accepted your scheduled trip.`), ...state.notices].slice(0, 50) };
}
export function matchDueSchedules(state: ScheduleState, now: number): ScheduleState {
  if (!Number.isFinite(now) || now < state.now) throw new Error("The simulation clock cannot move backwards.");
  const next = { ...state, now };
  let notices = state.notices;
  const trips = state.trips.map((trip): ScheduledTrip => {
    if (trip.status !== "RESERVED" || Date.parse(trip.departureAt) > now) return trip;
    const matched: ScheduledTrip = { ...trip, status: "MATCHED", matchedAt: new Date(now).toISOString() };
    notices = [notice(next, matched, "passenger", `It’s time for your trip with ${trip.driverName}.`), notice(next, matched, "driver", `Scheduled pickup is due: ${trip.pickup}.`), ...notices];
    return matched;
  });
  return { ...next, trips, notices: notices.slice(0, 50) };
}
export function cancelSchedule(state: ScheduleState, tripId: string): ScheduleState {
  const trip = state.trips.find((entry) => entry.id === tripId);
  if (!trip || !["OPEN", "RESERVED"].includes(trip.status)) throw new Error("This schedule can no longer be cancelled here.");
  const updated: ScheduledTrip = { ...trip, status: "CANCELLED" };
  return { ...state, trips: state.trips.map((entry) => entry.id === tripId ? updated : entry), notices: [notice(state, trip, "driver", `Scheduled trip cancelled: ${trip.pickup} → ${trip.destination}`), ...state.notices].slice(0, 50) };
}
