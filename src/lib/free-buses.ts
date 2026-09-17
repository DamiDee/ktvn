import type {
  BusActor, BusAllocation, BusBooking, BusDirection, BusServiceEvent,
  ChurchService, FreeBusState, ScheduleBusesInput,
} from "../types/free-buses";

export const SERVICE_NAMES: Record<ChurchService, string> = {
  KOINONIA: "Koinonia Sunday Service",
  TGA: "T.G.A (The General Assembly)",
};

export const DIRECTION_NAMES: Record<BusDirection, string> = {
  TO_SERVICE: "To service",
  FROM_SERVICE: "Going home",
};

export const ABUJA_BUS_POINTS = [
  "Lugbe Police Signpost", "Gwarinpa 1st Avenue", "Kubwa Express Junction",
  "Nyanya Motor Park", "Mararaba Junction", "Kuje Junction", "Gwagwalada Park",
];

export function busBookings(state: FreeBusState, busId: string) {
  return state.bookings.filter((booking) => booking.busId === busId && !booking.cancelledAt);
}

export function allocationAvailability(state: FreeBusState, allocation: BusAllocation) {
  const remaining = allocation.buses.filter((bus) => !bus.departedAt);
  return {
    total: allocation.buses.length,
    remaining: remaining.length,
    departed: allocation.buses.length - remaining.length,
    seats: remaining.reduce((sum, bus) => sum + bus.capacity - busBookings(state, bus.id).length, 0),
  };
}

export function journeyEndpoints(allocation: BusAllocation, event: BusServiceEvent) {
  return allocation.direction === "TO_SERVICE"
    ? { from: allocation.communityPoint, to: event.venue, meetingPoint: allocation.landmark }
    : { from: event.venue, to: allocation.communityPoint, meetingPoint: event.venueMeetingPoint };
}

export function existingLegBooking(state: FreeBusState, memberId: string, allocation: BusAllocation) {
  return state.bookings.find((booking) => {
    if (booking.memberId !== memberId || booking.cancelledAt) return false;
    const route = state.allocations.find((item) => item.id === booking.allocationId);
    return route?.eventId === allocation.eventId && route.direction === allocation.direction;
  });
}

function requireRole(actor: BusActor, role: BusActor["role"]) {
  if (actor.role !== role) throw new Error(role === "ADMIN"
    ? "Only the oversight team can manage bus schedules."
    : "Free Buses seat booking is available to members, excluding drivers.");
}

function integerInRange(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be a whole number between ${min} and ${max}.`);
  }
}

/** Pure transitions also run inside the repository's exclusive write transaction. */
export function scheduleBuses(state: FreeBusState, input: ScheduleBusesInput, actor: BusActor, id: string, now: string) {
  requireRole(actor, "ADMIN");
  integerInRange(input.busCount, 0, 30, "Number of buses");
  integerInRange(input.capacity, 1, 60, "Seats per bus");
  if (!(input.service in SERVICE_NAMES) || !(input.direction in DIRECTION_NAMES)) throw new Error("Choose a service and journey direction.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(`${input.date}T12:00:00+01:00`))) throw new Error("Choose a valid service date.");
  if (!input.communityPoint.trim() || !input.landmark.trim() || !input.venue.trim() || !input.venueMeetingPoint.trim() || !input.model.trim()) {
    throw new Error("Add the venue, meeting instructions, community point and bus model.");
  }
  if (!Number.isFinite(Date.parse(input.boardingAt)) || Date.parse(input.boardingAt) <= Date.parse(now)) throw new Error("Boarding must be scheduled for a future time.");
  const event = input.eventId
    ? state.events.find((item) => item.id === input.eventId)
    : state.events.find((item) => item.service === input.service && item.date === input.date);
  if (input.eventId && !event) throw new Error("This service schedule no longer exists. Refresh and try again.");
  const serviceEvent: BusServiceEvent = event ?? {
    id: `${id}-event`, service: input.service, date: input.date,
    venue: input.venue.trim(), venueMeetingPoint: input.venueMeetingPoint.trim(),
  };
  if (!input.eventId && event && (event.venue !== input.venue.trim() || event.venueMeetingPoint !== input.venueMeetingPoint.trim())) {
    throw new Error("This service date already has a venue. Choose its existing schedule to add a route.");
  }
  if (state.allocations.some((route) => route.eventId === serviceEvent.id && route.direction === input.direction && route.communityPoint.toLowerCase() === input.communityPoint.trim().toLowerCase())) {
    throw new Error("This location already has a schedule for that direction. Add buses to its existing allocation.");
  }
  const allocation: BusAllocation = {
    id, eventId: serviceEvent.id, direction: input.direction,
    communityPoint: input.communityPoint.trim(), landmark: input.landmark.trim(),
    boardingAt: input.boardingAt, buses: [],
  };
  allocation.buses = Array.from({ length: input.busCount }, (_, index) => ({
    id: `${id}-bus-${index + 1}`, label: `Bus ${String(index + 1).padStart(2, "0")}`,
    capacity: input.capacity, model: input.model.trim(),
  }));
  state.allocations.push(allocation);
  if (!event) state.events.push(serviceEvent);
  state.notices.unshift({
    id: `${id}-published`, allocationId: id, createdAt: now,
    title: `Free Buses · ${allocation.communityPoint}`,
    body: `${input.busCount} ${input.busCount === 1 ? "bus" : "buses"} scheduled · ${SERVICE_NAMES[serviceEvent.service]} · ${serviceEvent.date} · ${DIRECTION_NAMES[input.direction]}.`,
  });
  return allocation;
}

function announceDeparture(state: FreeBusState, allocation: BusAllocation, busId: string, now: string) {
  const bus = allocation.buses.find((item) => item.id === busId)!;
  if (bus.departedAt) return;
  bus.departedAt = now;
  const { total, departed, remaining } = allocationAvailability(state, allocation);
  const event = state.events.find((item) => item.id === allocation.eventId)!;
  state.notices.unshift({
    id: `${busId}-departed`, allocationId: allocation.id, createdAt: now,
    title: `${departed} of ${total} ${allocation.communityPoint} ${total === 1 ? "bus has" : "buses have"} left`,
    body: `${SERVICE_NAMES[event.service]} · ${DIRECTION_NAMES[allocation.direction]}. ${bus.label} is full and has left. ${remaining === 0 ? "All buses have departed. This slot is now closed." : `${remaining} ${remaining === 1 ? "bus remains" : "buses remain"}.`}`,
  });
}

export function reserveBusSeat(state: FreeBusState, allocationId: string, actor: BusActor, id: string, now: string): BusBooking {
  requireRole(actor, "PASSENGER");
  if (!actor.id || !actor.name.trim()) throw new Error("Sign in before booking a seat.");
  const allocation = state.allocations.find((route) => route.id === allocationId);
  if (!allocation) throw new Error("This bus route is no longer available.");
  if (existingLegBooking(state, actor.id, allocation)) throw new Error("You already have a seat for this service and direction. Your return journey can be booked separately.");
  const bus = allocation.buses.find((candidate) => !candidate.departedAt && busBookings(state, candidate.id).length < candidate.capacity);
  if (!bus) throw new Error("All buses for this slot have left. Please choose another location.");
  const taken = new Set(busBookings(state, bus.id).map((booking) => booking.seatNumber));
  let seatNumber = 1;
  while (taken.has(seatNumber)) seatNumber += 1;
  const booking: BusBooking = {
    id, reference: `FB-${id.slice(-8).toUpperCase()}`, allocationId,
    busId: bus.id, memberId: actor.id, memberName: actor.name.trim(), seatNumber, bookedAt: now,
  };
  state.bookings.push(booking);
  if (busBookings(state, bus.id).length === bus.capacity) announceDeparture(state, allocation, bus.id, now);
  return booking;
}

export function cancelBusSeat(state: FreeBusState, bookingId: string, actor: BusActor, now: string) {
  requireRole(actor, "PASSENGER");
  const booking = state.bookings.find((item) => item.id === bookingId && item.memberId === actor.id);
  if (!booking || booking.cancelledAt) throw new Error("This reservation is no longer active.");
  const bus = state.allocations.find((item) => item.id === booking.allocationId)?.buses.find((item) => item.id === booking.busId);
  if (!bus || bus.departedAt) throw new Error("This bus has already departed. Its seat can no longer be cancelled.");
  booking.cancelledAt = now;
}

export function addBuses(state: FreeBusState, allocationId: string, count: number, capacity: number, model: string, actor: BusActor, now: string) {
  requireRole(actor, "ADMIN");
  integerInRange(count, 1, 30, "Additional buses");
  integerInRange(capacity, 1, 60, "Seats per bus");
  if (!model.trim()) throw new Error("Enter the bus model.");
  const route = state.allocations.find((item) => item.id === allocationId);
  if (!route) throw new Error("This allocation no longer exists.");
  const offset = route.buses.length;
  if (offset + count > 30) throw new Error("A location can have up to 30 buses per direction.");
  for (let i = 1; i <= count; i += 1) route.buses.push({
    id: `${route.id}-bus-${offset + i}`, label: `Bus ${String(offset + i).padStart(2, "0")}`, capacity, model: model.trim(),
  });
  state.notices.unshift({
    id: `${route.id}-added-${offset + count}`, allocationId: route.id, createdAt: now,
    title: `More buses at ${route.communityPoint}`,
    body: `${count} ${count === 1 ? "bus added" : "buses added"} · ${DIRECTION_NAMES[route.direction]}. ${allocationAvailability(state, route).remaining} now available.`,
  });
}

/** Demo-only: exercises exactly the same booking/departure transition as member bookings. */
export function fillNextBus(state: FreeBusState, allocationId: string, actor: BusActor, now: string) {
  requireRole(actor, "ADMIN");
  const route = state.allocations.find((item) => item.id === allocationId);
  const bus = route?.buses.find((item) => !item.departedAt);
  if (!route || !bus) throw new Error("No buses remain at this location.");
  const count = bus.capacity - busBookings(state, bus.id).length;
  for (let i = 0; i < count; i += 1) {
    const id = `${bus.id}-demo-${i}-${state.bookings.length}`;
    reserveBusSeat(state, route.id, { id, role: "PASSENGER", name: `Demo member ${i + 1}` }, id, now);
  }
}
