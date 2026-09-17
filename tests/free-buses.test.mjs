import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addBuses, allocationAvailability, busBookings, cancelBusSeat,
  fillNextBus, journeyEndpoints, reserveBusSeat, scheduleBuses,
} from "../src/lib/free-buses.ts";

const now = "2026-09-16T10:00:00.000Z";
const admin = { id: "admin", name: "Oversight", role: "ADMIN" };
const member = (id) => ({ id, name: `Member ${id}`, role: "PASSENGER" });
const input = {
  service: "KOINONIA", date: "2026-09-20", venue: "Koinonia Centre",
  venueMeetingPoint: "Bus bay B", direction: "TO_SERVICE",
  communityPoint: "Lugbe Police Signpost", landmark: "Beside the signpost",
  boardingAt: "2026-09-20T14:00:00+01:00", busCount: 3, capacity: 18, model: "Toyota Hiace",
};
function setup(overrides = {}) {
  const state = { events: [], allocations: [], bookings: [], notices: [] };
  const route = scheduleBuses(state, { ...input, ...overrides }, admin, "lugbe", now);
  return { state, route };
}

test("54 bookings fill 3 buses in order; every final seat closes one bus and broadcasts once", () => {
  const { state, route } = setup();
  for (let i = 1; i <= 54; i += 1) {
    const booking = reserveBusSeat(state, route.id, member(`member-${i}`), `booking-${i}`, now);
    assert.equal(booking.busId, `lugbe-bus-${Math.ceil(i / 18)}`);
    assert.equal(booking.seatNumber, (i - 1) % 18 + 1);
    const available = allocationAvailability(state, route);
    assert.equal(available.remaining, 3 - Math.floor(i / 18));
    assert.equal(available.seats, 54 - i);
  }
  assert.equal(state.notices.filter((notice) => notice.id.endsWith("-departed")).length, 3);
  assert.match(state.notices[0].body, /All buses have departed/);
  assert.throws(() => reserveBusSeat(state, route.id, member("too-late"), "last", now), /All buses/);
  assert.equal(state.bookings.length, 54);
});

test("the last available seat cannot be allocated twice", () => {
  const { state, route } = setup({ busCount: 1, capacity: 1 });
  reserveBusSeat(state, route.id, member("first"), "first", now);
  assert.throws(() => reserveBusSeat(state, route.id, member("second"), "second", now), /All buses/);
  assert.equal(busBookings(state, route.buses[0].id).length, 1);
  assert.equal(state.notices.length, 2);
});

test("return has an independent location and seat; duplicate bookings across outbound points are rejected", () => {
  const { state, route } = setup();
  const other = scheduleBuses(state, { ...input, eventId: route.eventId, communityPoint: "Kubwa" }, admin, "kubwa", now);
  const home = scheduleBuses(state, { ...input, eventId: route.eventId, direction: "FROM_SERVICE", communityPoint: "FHA Junction" }, admin, "home", now);
  reserveBusSeat(state, route.id, member("grace"), "out", now);
  assert.throws(() => reserveBusSeat(state, other.id, member("grace"), "duplicate", now), /already have a seat/);
  reserveBusSeat(state, home.id, member("grace"), "back", now);
  assert.deepEqual(journeyEndpoints(home, state.events[0]), { from: "Koinonia Centre", to: "FHA Junction", meetingPoint: "Bus bay B" });
  assert.equal(state.bookings.length, 2);
  assert.equal(state.events.length, 1);
});

test("cancellation releases precisely the member's seat, which the next booking can reuse", () => {
  const { state, route } = setup();
  reserveBusSeat(state, route.id, member("one"), "one", now);
  reserveBusSeat(state, route.id, member("two"), "two", now);
  assert.throws(() => cancelBusSeat(state, "one", member("two"), now), /no longer active/);
  cancelBusSeat(state, "one", member("one"), now);
  const next = reserveBusSeat(state, route.id, member("three"), "three", now);
  assert.equal(next.seatNumber, 1);
  assert.equal(busBookings(state, next.busId).length, 2);
});

test("departed buses cannot be cancelled or reopened; additional buses reopen the route", () => {
  const { state, route } = setup({ busCount: 1, capacity: 1 });
  reserveBusSeat(state, route.id, member("one"), "one", now);
  assert.throws(() => cancelBusSeat(state, "one", member("one"), now), /already departed/);
  addBuses(state, route.id, 1, 18, "Toyota Hiace", admin, now);
  const booking = reserveBusSeat(state, route.id, member("two"), "two", now);
  assert.equal(booking.busId, "lugbe-bus-2");
  assert.ok(route.buses[0].departedAt);
});

test("drivers are excluded; only admins can schedule, add buses or simulate departures", () => {
  const { state, route } = setup();
  const driver = { ...member("driver"), role: "DRIVER" };
  assert.throws(() => reserveBusSeat(state, route.id, driver, "x", now), /excluding drivers/);
  assert.throws(() => reserveBusSeat(state, route.id, admin, "x", now), /members/);
  assert.throws(() => scheduleBuses(state, input, driver, "x", now), /oversight/);
  assert.throws(() => addBuses(state, route.id, 1, 18, "Toyota", member("one"), now), /oversight/);
  assert.throws(() => fillNextBus(state, route.id, member("one"), now), /oversight/);
});

test("invalid schedules are rejected and zero-bus allocations remain unavailable", () => {
  const { state, route } = setup({ busCount: 0 });
  assert.deepEqual(allocationAvailability(state, route), { total: 0, remaining: 0, departed: 0, seats: 0 });
  assert.throws(() => reserveBusSeat(state, route.id, member("one"), "one", now), /All buses/);
  assert.throws(() => scheduleBuses(state, { ...input, capacity: 18.5 }, admin, "bad", now), /whole number/);
  assert.throws(() => scheduleBuses(state, { ...input, busCount: -1 }, admin, "bad", now), /whole number/);
  assert.throws(() => scheduleBuses(state, { ...input, boardingAt: now }, admin, "bad", now), /future time/);
  assert.throws(() => scheduleBuses(state, { ...input, eventId: "deleted" }, admin, "bad", now), /no longer exists/);
  assert.throws(() => scheduleBuses(state, input, admin, "duplicate", now), /already has a schedule/);
  assert.equal(state.allocations.length, 1);
});

test("admin simulation preserves booked seats and triggers one departure", () => {
  const { state, route } = setup();
  const booking = reserveBusSeat(state, route.id, member("grace"), "grace", now);
  fillNextBus(state, route.id, admin, now);
  assert.equal(state.bookings.find((item) => item.id === "grace"), booking);
  assert.equal(busBookings(state, booking.busId).length, 18);
  assert.equal(allocationAvailability(state, route).remaining, 2);
  assert.match(state.notices[0].title, /1 of 3 Lugbe/);
});
