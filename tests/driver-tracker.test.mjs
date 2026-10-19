import test from "node:test";
import assert from "node:assert/strict";
import { driverTrackerFrame } from "../src/features/paid-rides/pip/driver-tracker-frame.ts";
import { initialDriverSession } from "../src/features/paid-rides/domain/driver-session.ts";

const now = 1_000_000;
const fix = { point: { lat: 9, lng: 7 }, timestamp: now, heading: 40, speedMps: 0, accuracyMeters: 10 };
const online = { ...initialDriverSession, availability: "ONLINE", ride: { ...initialDriverSession.ride, connection: "open" } };

test("driver tracker remains available while waiting and closes offline", () => {
  assert.equal(driverTrackerFrame(initialDriverSession, fix, now), null);
  const frame = driverTrackerFrame(online, fix, now);
  assert.equal(frame.status, "Waiting for requests");
  assert.deepEqual(frame.vehicle, fix.point);
  assert.match(frame.detail, /^GPS at /);
});

test("old or absent GPS is never labelled live and timestamp stays honest", () => {
  const fresh = driverTrackerFrame(online, fix, now);
  const stale = driverTrackerFrame(online, fix, now + 31_000);
  assert.equal(stale.status, "Location paused — return to K-Rides");
  assert.equal(stale.detail, fresh.detail);
  assert.equal(driverTrackerFrame(online, null, now).etaValue, "GPS?");
});

test("connection loss and incoming requests are actionable in the tracker", () => {
  assert.equal(driverTrackerFrame({ ...online, ride: { ...online.ride, connection: "reconnecting" } }, fix, now).status, "Reconnecting — return to K-Rides");
  assert.equal(driverTrackerFrame({ ...online, offer: { phase: "incoming" } }, fix, now).status, "New request — open K-Rides");
});

test("active and paused trips track the destination; pickup tracks the pickup", () => {
  const ride = {
    pickup: { name: "Pickup", point: { lat: 9.1, lng: 7.1 } },
    destination: { name: "Destination", point: { lat: 9.2, lng: 7.2 } },
    route: { points: [{ lat: 9, lng: 7 }, { lat: 9.2, lng: 7.2 }] },
    approach: { route: { points: [{ lat: 9, lng: 7 }, { lat: 9.1, lng: 7.1 }] } },
  };
  for (const status of ["IN_PROGRESS", "PAUSED", "DRIVER_EN_ROUTE"]) {
    const frame = driverTrackerFrame({ ...online, ride: { ...online.ride, ride: { ...ride, status } } }, fix, now);
    assert.equal(frame.targetKind, status === "DRIVER_EN_ROUTE" ? "pickup" : "destination");
    assert.deepEqual(frame.target, status === "DRIVER_EN_ROUTE" ? ride.pickup.point : ride.destination.point);
  }
});
