import test from "node:test";
import assert from "node:assert/strict";
import { journeyTypeLabel, routePointIds, walkInAllocation } from "../src/lib/journey-experience.ts";
import { activityTime } from "../src/lib/trips.ts";
import { boardingProblem } from "../src/lib/boarding.ts";
import { readReturnPreference, saveReturnPreference } from "../src/lib/return-preference.ts";

const bus = { id: "bus", current_trip_id: "trip", state: "Boarding", status: "InUse", capacity: 18, current_passenger_count: 15 };
const trip = { id: "trip", route_id: "route", status: "NotStarted", departure_time: "2020-01-01T10:00:00" };
test("boarding uses valid state, not a departure-time cutoff", () => {
  assert.equal(boardingProblem({ bus_id: "bus", trip_id: "trip", route_id: "route", status: "Confirmed", payment_status: "Free" }, bus, trip), null);
});
test("walk-in allocation adds to the existing count without inventing tickets", () => {
  assert.deepEqual(walkInAllocation(bus, trip, 3), { passenger_count: 18 });
  for (const count of [0, -1, 1.5, NaN, Infinity, 4]) assert.throws(() => walkInAllocation(bus, trip, count));
});
test("walk-ins cannot change a mismatched, closed, moving or maintenance bus", () => {
  for (const override of [{ current_trip_id: null }, { current_trip_id: "other" }, { status: "Maintenance" }, { state: "Transit" }, { current_passenger_count: -1 }]) assert.throws(() => walkInAllocation({ ...bus, ...override }, trip, 1));
  for (const status of ["InProgress", "Completed", "Cancelled"]) assert.throws(() => walkInAllocation(bus, { ...trip, status }, 1));
});
test("ticket journey labels distinguish both directions and round trips", () => {
  assert.equal(journeyTypeLabel("Pickup"), "To church"); assert.equal(journeyTypeLabel("Dropoff"), "To home"); assert.equal(journeyTypeLabel("RoundTrip"), "Round trip"); assert.equal(journeyTypeLabel(null), "Journey type unavailable");
});
test("published intermediate stops remain in route order with terminals once", () => {
  assert.deepEqual(routePointIds({ start_point: "a", end_point: "d", stops: ["a", "c", "b", "d"] }), ["a", "c", "b", "d"]);
  assert.deepEqual(routePointIds({ start_point: "a", end_point: "d", stops: [] }), ["a", "d"]);
});
test("activity uses UTC-naive API timestamps and explicit WAT, not device timezone", () => {
  const now = Date.parse("2026-09-30T12:00:30Z");
  for (const value of ["2026-09-30T12:00:00", "2026-09-30T12:00:00Z", "2026-09-30T13:00:00+01:00"]) {
    const time = activityTime(value, now); assert.equal(time.relative, "Just now"); assert.equal(time.absolute, "2026-09-30 · 13:00:00 WAT");
  }
  assert.equal(activityTime("2026-09-30T11:55:00", now).relative, "5 min ago");
  assert.equal(activityTime("invalid", now).absolute, "Time unavailable");
  assert.equal(activityTime("2026-09-30T13:00:00Z", now).relative, "Timestamp ahead of device clock");
});
test("round-trip preferences are isolated by member and ticket and tolerate blocked storage", () => {
  const values = new Map();
  globalThis.window = { localStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } };
  try {
    assert.equal(saveReturnPreference("one", "ticket", true), true);
    assert.equal(readReturnPreference("one", "ticket"), true);
    assert.equal(readReturnPreference("two", "ticket"), false);
    assert.equal(readReturnPreference("one", "other"), false);
    assert.equal(saveReturnPreference("one", "ticket", false), true);
    assert.equal(readReturnPreference("one", "ticket"), false);
    window.localStorage.setItem = () => { throw new Error("blocked"); };
    assert.equal(saveReturnPreference("one", "ticket", true), false);
  } finally { delete globalThis.window; }
});
