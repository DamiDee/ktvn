import test from "node:test";
import assert from "node:assert/strict";
import { apiTimestamp, tripCanBook, watInputToApiTime, watParts, scheduledJourneys } from "../src/lib/trips.ts";

const route = { id: "route", name: "Lugbe to church", fare: 0 };
const trip = { id: "sunday-one", route_id: "route", departure_time: "2030-01-06T09:00:00+01:00", ride_type: "Pickup", status: "NotStarted" };
const saturday = Date.parse("2030-01-05T12:00:00Z");
test("departure and arrival serialize as timezone-free UTC for the deployed trip parser", () => {
  const payload = {
    departure_time: watInputToApiTime("2026-09-27T10:00"),
    arrival_time: watInputToApiTime("2026-09-27T11:00"),
  };
  assert.deepEqual(payload, { departure_time: "2026-09-27T09:00:00", arrival_time: "2026-09-27T10:00:00" });
  for (const value of Object.values(payload)) assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  assert.equal(watParts(payload.departure_time).time, "10:00:00");
  assert.equal(Date.parse(apiTimestamp(payload.departure_time)), Date.parse("2026-09-27T10:00:00+01:00"));
});
test("Sunday midnight rolls back to Saturday UTC but stays Sunday in Abuja", () => {
  const timestamp = watInputToApiTime("2030-01-06T00:30");
  assert.equal(timestamp, "2030-01-05T23:30:00");
  assert.deepEqual(watParts(timestamp), { date: "2030-01-06", time: "00:30:00", sunday: true });
  assert.equal(tripCanBook({ ...trip, departure_time: timestamp }, route, saturday, true), true);
});
test("datetime-local seconds are not duplicated, and invalid calendar values are rejected", () => {
  assert.equal(watInputToApiTime("2030-01-06T09:00:30"), "2030-01-06T08:00:30");
  assert.equal(watInputToApiTime("2030-01-06T09:00:30.125"), "2030-01-06T08:00:30.125");
  for (const value of ["", "invalid", "2030-02-30T09:00", "2030-01-06T24:00", "2030-01-06T09:60", "2030-01-06T09:00:60", "2030-01-06T09:00:00+01:00", "2030-01-06T09:00:00:00"]) assert.equal(watInputToApiTime(value), null);
});
test("a member can book on Saturday for Sunday travel, never for Monday", () => {
  assert.equal(tripCanBook(trip, route, saturday, true), true);
  assert.equal(tripCanBook({ ...trip, departure_time: "2030-01-07T09:00:00+01:00" }, route, saturday, true), false);
  assert.equal(tripCanBook({ ...trip, departure_time: "2030-01-07T09:00:00+01:00" }, route, saturday, false), true);
});
test("Sunday is checked in Abuja time, not UTC or the device timezone", () => {
  assert.equal(watParts("2030-01-05T23:30:00Z").sunday, true);
  assert.equal(watParts("2030-01-06T23:30:00Z").sunday, false);
  assert.deepEqual(watParts("2030-01-06T08:00:00"), { date: "2030-01-06", time: "09:00:00", sunday: true });
  assert.equal(watParts("invalid").sunday, false);
});
test("booking requires the matching, free, upcoming, not-started trip", () => {
  for (const status of ["InProgress", "Completed", "Cancelled"]) assert.equal(tripCanBook({ ...trip, status }, route, saturday, true), false);
  assert.equal(tripCanBook(trip, { ...route, id: "different" }, saturday, true), false);
  assert.equal(tripCanBook(trip, { ...route, fare: 100 }, saturday, true), false);
  assert.equal(tripCanBook(trip, route, Date.parse(trip.departure_time), true), false);
  assert.equal(tripCanBook({ ...trip, departure_time: "invalid" }, route, saturday, true), false);
});
test("one reusable route gives each Sunday its own journey and ticket identity", () => {
  const journeys = scheduledJourneys([route], [trip, { ...trip, id: "sunday-two", departure_time: "2030-01-13T09:00:00+01:00" }, { ...trip, route_id: "deleted" }]);
  assert.deepEqual(journeys.map((j) => j.id), ["sunday-one", "sunday-two"]);
  assert.deepEqual(journeys.map((j) => j.route_id), ["route", "route"]);
  assert.deepEqual(journeys.map((j) => j.departure_date), ["2030-01-06", "2030-01-13"]);
  assert.equal(journeys[0].departure_time, "09:00:00");
});
