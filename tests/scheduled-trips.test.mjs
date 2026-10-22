import test from "node:test";
import assert from "node:assert/strict";
import { localScheduleDemo, seedSchedules, createSchedule, acceptSchedule, matchDueSchedules, cancelSchedule } from "../src/features/paid-rides/scheduling/scheduled-trips.ts";
const now = Date.parse("2026-10-21T09:00:00Z");

test("scheduled-trip simulation requires both development mode and a loopback host", () => {
  for (const host of ["localhost", "127.0.0.1", "::1", "[::1]"]) {
    assert.equal(localScheduleDemo("development", host), true);
    for (const mode of ["production", "test", undefined]) assert.equal(localScheduleDemo(mode, host), false);
  }
  for (const host of ["app.freebus.cloud", "preview.freebus.cloud", "localhost.evil.test", "192.168.1.2", ""]) assert.equal(localScheduleDemo("development", host), false);
});
test("creating a future trip immediately notifies drivers without assigning a driver", () => {
  const state = seedSchedules(now);
  const result = createSchedule(state, { id: "new-trip", pickup: "  Jabi  ", destination: "Airport", departureAt: new Date(now + 86400000).toISOString() });
  assert.equal(result.trips[0].status, "OPEN");
  assert.equal(result.trips[0].pickup, "Jabi");
  assert.equal(result.trips[0].driverId, undefined);
  assert.equal(result.notices[0].audience, "driver");
  assert.equal(result.notices[0].tripId, "new-trip");
  assert.equal(state.trips.length, 2);
});
test("past dates, invalid dates, empty locations and duplicate schedules are rejected", () => {
  const state = seedSchedules(now);
  const input = { id: "valid-id", pickup: "Jabi", destination: "Airport", departureAt: new Date(now + 86400000).toISOString() };
  for (const patch of [{ departureAt: new Date(now).toISOString() }, { departureAt: "invalid" }, { pickup: " " }, { destination: "jabi" }, { id: state.trips[0].id }]) assert.throws(() => createSchedule(state, { ...input, ...patch }));
});
test("first acceptance reserves the driver; competing drivers cannot replace the winner", () => {
  const state = seedSchedules(now);
  const reserved = acceptSchedule(state, "demo-schedule-1", "demo-driver-b");
  assert.equal(reserved.trips[0].status, "RESERVED");
  assert.equal(reserved.trips[0].driverId, "demo-driver-b");
  assert.equal(reserved.trips[0].matchedAt, undefined);
  assert.throws(() => acceptSchedule(reserved, "demo-schedule-1", "demo-driver-a"));
  assert.equal(reserved.trips[0].driverId, "demo-driver-b");
  assert.throws(() => acceptSchedule(state, "demo-schedule-1", "unknown-driver"));
});
test("matching waits for departure, then informs passenger and driver exactly once", () => {
  const reserved = acceptSchedule(seedSchedules(now), "demo-schedule-1", "demo-driver-a");
  const departure = Date.parse(reserved.trips[0].departureAt);
  assert.equal(matchDueSchedules(reserved, departure - 1).trips[0].status, "RESERVED");
  const matched = matchDueSchedules(reserved, departure);
  assert.equal(matched.trips[0].status, "MATCHED");
  assert.equal(matched.trips[0].driverId, "demo-driver-a");
  assert.equal(matched.notices[0].audience, "passenger");
  assert.equal(matched.notices[1].audience, "driver");
  assert.equal(matchDueSchedules(matched, departure + 1000).notices.length, matched.notices.length);
  assert.equal(matchDueSchedules(seedSchedules(now), departure).trips[0].status, "OPEN");
});
test("cancelled schedules cannot be claimed or matched, and time cannot go backwards", () => {
  const reserved = acceptSchedule(seedSchedules(now), "demo-schedule-1", "demo-driver-a");
  const cancelled = cancelSchedule(reserved, "demo-schedule-1");
  assert.equal(cancelled.trips[0].status, "CANCELLED");
  assert.throws(() => acceptSchedule(cancelled, "demo-schedule-1", "demo-driver-b"));
  assert.equal(matchDueSchedules(cancelled, now + 86400000).trips[0].status, "CANCELLED");
  assert.throws(() => matchDueSchedules(cancelled, now - 1));
});
