import test from "node:test";
import assert from "node:assert/strict";
import { bookingBoardingOpen, boardingProblem, qrImageSource } from "../src/lib/boarding.ts";
import { knownPlaces, routingCoordinates } from "../src/lib/transport-locations.ts";

const booking = { id: "ticket", bus_id: "bus", route_id: "route", trip_id: "trip", status: "Confirmed", payment_status: "Free" };
const bus = { id: "bus", current_trip_id: "trip", status: "Available", state: "Boarding" };
const route = { id: "trip", route_id: "route", status: "NotStarted" };
test("only confirmed, cleared tickets on the selected open bus may board", () => {
  assert.equal(boardingProblem(booking, bus, route), null);
  for (const status of ["Boarded", "Cancelled", "Revoked"]) assert.ok(boardingProblem({ ...booking, status }, bus, route));
  assert.ok(boardingProblem({ ...booking, bus_id: "other" }, bus, route));
  assert.ok(boardingProblem({ ...booking, route_id: "old" }, bus, route));
  assert.ok(boardingProblem({ ...booking, payment_status: "Pending" }, bus, route));
  assert.ok(boardingProblem(booking, { ...bus, status: "Maintenance" }, route));
  assert.ok(boardingProblem(booking, { ...bus, state: "Transit" }, route));
  for (const status of ["Completed", "Cancelled"]) assert.ok(boardingProblem(booking, bus, { ...route, status }));
  // A pass for last Sunday's journey cannot board the same bus on the same route again.
  assert.ok(boardingProblem({ ...booking, trip_id: "last-week" }, bus, route));
  assert.ok(boardingProblem({ ...booking, trip_id: undefined }, bus, route));
});
test("QR rendering accepts PNG base64 only, never external URLs or HTML", () => {
  const png = "iVBORw0KGgoAAAANSUhEUg==";
  assert.equal(qrImageSource(png), `data:image/png;base64,${png}`);
  assert.equal(qrImageSource(`data:image/png;base64,${png}`), `data:image/png;base64,${png}`);
  for (const raw of ["https://example.com/ticket", "<svg></svg>", "data:text/html;base64,abcd", ""]) assert.equal(qrImageSource(raw), null);
});

const roundTrip = { ...route, ride_type: "RoundTrip", status: "InProgress", arrival_time: "2026-10-16T10:00:00Z", return_time: "2026-10-16T17:00:00Z" };
const returnPass = { ...booking, id: "return-ticket", pickup_point: "church", dropoff_point: "stop" };

test("existing passengers can join an in-progress trip at later stops without bus-state toggles", () => {
  const laterStopPass = { ...booking, pickup_point: "stop", dropoff_point: "church" };
  for (const ride_type of ["Pickup", "Dropoff", "RoundTrip"]) {
    const runningTrip = { ...roundTrip, ride_type };
    assert.equal(bookingBoardingOpen(laterStopPass, runningTrip), true);
    for (const state of ["Boarding", "Stationary", "Transit", "Arrived"]) {
      assert.equal(boardingProblem(laterStopPass, { ...bus, state }, runningTrip), null);
    }
  }
  // A legacy pass without saved stops still uses its authenticated booking and trip.
  assert.equal(boardingProblem(booking, { ...bus, state: "Transit" }, roundTrip), null);
});

test("outbound and return bookings remain independent throughout the same round trip", () => {
  const outbound = { ...booking, id: "outbound-ticket", pickup_point: "stop", dropoff_point: "church" };
  const assignedBus = { ...bus, state: "Arrived" };
  assert.equal(boardingProblem(outbound, assignedBus, roundTrip), null);
  assert.ok(boardingProblem({ ...outbound, status: "Boarded" }, assignedBus, roundTrip));
  assert.equal(bookingBoardingOpen(returnPass, roundTrip), true);
  assert.equal(boardingProblem(returnPass, assignedBus, roundTrip), null);
  assert.equal(bookingBoardingOpen(returnPass, { ...roundTrip, status: "NotStarted" }), true);
  for (const change of [{ return_time: null }, { return_time: "invalid" }]) {
    assert.equal(boardingProblem(returnPass, assignedBus, { ...roundTrip, ...change }), null);
  }
});

test("in-progress boarding preserves terminal status, assignment, clearance and duplicate checks", () => {
  for (const status of ["Completed", "Cancelled"]) {
    const closed = { ...roundTrip, status };
    assert.equal(bookingBoardingOpen(returnPass, closed), false);
    assert.ok(boardingProblem(returnPass, bus, closed));
  }
  for (const status of ["Boarded", "Cancelled", "Revoked"]) {
    assert.equal(bookingBoardingOpen({ ...returnPass, status }, roundTrip), false);
    assert.ok(boardingProblem({ ...returnPass, status }, bus, roundTrip));
  }
  for (const change of [{ status: "Maintenance" }, { current_trip_id: "other" }, { current_trip_id: null }]) {
    assert.ok(boardingProblem(returnPass, { ...bus, ...change }, roundTrip));
  }
  for (const change of [{ trip_id: "old" }, { trip_id: null }, { route_id: "other" }, { bus_id: "other" }, { payment_status: "Pending" }]) {
    assert.ok(boardingProblem({ ...returnPass, ...change }, bus, roundTrip));
  }
  assert.equal(bookingBoardingOpen(returnPass), false);
});
test("Chida spelling variants use the supplied Utako coordinates", () => {
  for (const name of ["Chida", "CHIDA EVENT CENTER", "Chida Event Centre Utako"]) assert.equal(knownPlaces(name)[0].lat, 9.07081);
  assert.deepEqual(knownPlaces("Lugbe"), []);
});
test("road routing preserves stop order and rejects malformed coordinates", () => {
  assert.equal(routingCoordinates([{ lat: 9, lng: 7 }, { lat: 9.1, lng: 7.1 }, { lat: 9.2, lng: 7.2 }]), "7,9;7.1,9.1;7.2,9.2");
  assert.throws(() => routingCoordinates([{ lat: 91, lng: 7 }, { lat: 9, lng: 7 }]));
  assert.throws(() => routingCoordinates([{ lat: NaN, lng: 7 }, { lat: 9, lng: 7 }]));
  assert.throws(() => routingCoordinates([]));
});
