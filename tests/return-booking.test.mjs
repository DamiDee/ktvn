import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assignedBookingBuses, bookingPayload, bookingPointsValid, bookingLeg, bookingLegLabel, bookingDeparture } from "../src/lib/journey-experience.ts";
import { canRequestScheduledTrip, tripHasReturn, watParts } from "../src/lib/trips.ts";
import { GUIDE_VERSION, guideKey, parseGuideProgress } from "../src/lib/member-guide.ts";

const route = { id: "r1", name: "Lugbe to church", fare: 0, start_point: "lugbe", stops: ["airport", null, "utako"], end_point: "church" };
const trip = { id: "t1", route_id: "r1", bus_id: "b1", ride_type: "RoundTrip", status: "NotStarted", departure_time: "2099-10-04T08:00:00", arrival_time: "2099-10-04T09:00:00", return_time: "2099-10-04T15:00:00" };
const bus = { id: "b1", current_trip_id: "t1", status: "InUse", state: "Boarding", capacity: 18, current_passenger_count: 15 };
const booking = { id: "outbound", pickup_point: "airport", dropoff_point: "church", trip_id: trip.id };
const now = Date.parse("2099-10-01T12:00:00Z");

test("booking requires explicit, distinct points in route order, including intermediate stops", () => {
  assert.equal(bookingPointsValid(route, "airport", "church"), true);
  assert.equal(bookingPointsValid(route, "airport", "utako"), true);
  for (const [from, to] of [["", "church"], ["lugbe", ""], ["airport", "airport"], ["church", "airport"], ["invented", "church"]]) assert.equal(bookingPointsValid(route, from, to), false);
});
test("return booking sends documented required fields once, including child count and both points", () => {
  const payload = bookingPayload(trip, route, bus, "airport", "church", 2, true);
  assert.deepEqual(payload, { bus_id: "b1", route_id: "r1", trip_id: "t1", pickup_point: "airport", dropoff_point: "church", num_of_kids: 2, return_trip: true });
  const schema = JSON.parse(readFileSync(new URL("../public/openapi.json", import.meta.url))).components.schemas.CreateBookingDto;
  for (const field of schema.required) assert.ok(field in payload, field);
  for (const field of Object.keys(payload)) assert.ok(field in schema.properties, field);
  assert.equal(bookingPayload(trip, route, bus, "airport", "church", 0, false).return_trip, false);
});
test("unrelated, in-transit, maintenance and full buses cannot supply a booking", () => {
  assert.deepEqual(assignedBookingBuses(trip, [{ ...bus, current_trip_id: null }]).map(b => b.id), ["b1"]);
  for (const bad of [{ ...bus, id: "other", current_trip_id: null }, { ...bus, current_trip_id: "different" }, { ...bus, state: "Transit" }, { ...bus, status: "Maintenance" }]) assert.throws(() => bookingPayload(trip, route, bad, "airport", "church", 0, false));
  for (const bad of [{ ...bus, capacity: NaN }, { ...bus, current_passenger_count: -1 }, { ...bus, current_passenger_count: undefined }]) assert.throws(() => bookingPayload(trip, route, bad, "airport", "church", 0, false));
  for (const kids of [-1, 1.5, 3, NaN]) assert.throws(() => bookingPayload(trip, route, bus, "airport", "church", kids, true));
  assert.throws(() => bookingPayload({ ...trip, return_time: null }, route, bus, "airport", "church", 0, true));
});
test("only a valid scheduled return after outbound arrival enables round-trip booking", () => {
  assert.equal(tripHasReturn(trip), true);
  for (const return_time of [null, "", "invalid", trip.arrival_time, "2099-10-04T07:00:00"]) assert.equal(tripHasReturn({ ...trip, return_time }), false);
  assert.equal(tripHasReturn({ ...trip, ride_type: "Dropoff" }), false);
});
test("distinct server-issued passes use their own leg, stops and departure time", () => {
  const returning = { ...booking, id: "homeward", pickup_point: "church", dropoff_point: "airport" };
  assert.equal(bookingLeg(booking, trip, route), "outbound");
  assert.equal(bookingLeg(returning, trip, route), "return");
  assert.equal(bookingLegLabel(returning, trip, route), "To home · Return pass");
  assert.equal(bookingDeparture(booking, trip, route), trip.departure_time);
  assert.equal(bookingDeparture(returning, trip, route), trip.return_time);
  assert.equal(watParts(bookingDeparture(returning, trip, route)).time, "16:00:00");
  assert.equal(bookingLeg({ ...booking, pickup_point: null }, trip, route), "unknown");
  assert.equal(bookingDeparture({ ...booking, pickup_point: null }, trip, route), null);
  // A separately scheduled Dropoff has its own departure, even if route IDs differ.
  const homeTrip = { ...trip, id: "t2", ride_type: "Dropoff", return_time: null, departure_time: "2099-10-04T17:00:00" };
  assert.equal(bookingDeparture(returning, homeTrip, route), homeTrip.departure_time);
  assert.equal(bookingDeparture(returning, { ...homeTrip, return_time: trip.return_time }, route), homeTrip.departure_time);
});
test("requests are confined to a real upcoming trip and its exact WAT date", () => {
  assert.equal(canRequestScheduledTrip(trip, route, "2099-10-04", now), true);
  for (const date of ["2099-10-05", "2099-10-03", ""]) assert.equal(canRequestScheduledTrip(trip, route, date, now), false);
  for (const status of ["Cancelled", "Completed", "InProgress"]) assert.equal(canRequestScheduledTrip({ ...trip, status }, route, "2099-10-04", now), false);
  assert.equal(canRequestScheduledTrip(trip, route, "2099-10-04", Date.parse("2100-01-01T00:00:00Z")), false);
  assert.equal(canRequestScheduledTrip(trip, { ...route, id: "deleted" }, "2099-10-04", now), false);
});
test("walkthrough completion is versioned, per member, and requires the last step", () => {
  assert.notEqual(guideKey("a"), guideKey("b"));
  for (const raw of [null, "seen", '"seen"', "{}", '{"step":4,"completed_at":"2099-10-01"}', JSON.stringify({ version: 1, step: 4, completed_at: "2099-10-01" }), JSON.stringify({ version: GUIDE_VERSION, step: 2, completed_at: "2099-10-01" })]) assert.equal(parseGuideProgress(raw).completed_at, null);
  const progress = { version: GUIDE_VERSION, step: 3, completed_at: null };
  assert.deepEqual(parseGuideProgress(JSON.stringify(progress)), progress);
  const complete = { version: GUIDE_VERSION, step: 4, completed_at: "2099-10-01T12:00:00Z" };
  assert.deepEqual(parseGuideProgress(JSON.stringify(complete)), complete);
});
