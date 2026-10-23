import test from "node:test";
import assert from "node:assert/strict";
import { localScheduleDemo, seedSchedules, demoEstimate, DEMO_PLACES, DEMO_DRIVERS, demoId, createSchedule, acceptSchedule, rescheduleSchedule, releaseSchedule, matchDueSchedules, cancelSchedule, completeDemoSchedule } from "../src/features/paid-rides/scheduling/scheduled-trips.ts";
import { bookingSchema, HOUR, DAY, resolveScheduleTime, localScheduleTime, validateBookingTime, reasonSchema, preferNewerBooking } from "../src/features/paid-rides/scheduling/contract.ts";
const now = Date.parse("2026-10-22T09:00:00Z");
const a = DEMO_DRIVERS[0].id, b = DEMO_DRIVERS[1].id, id = demoId(100);
function quoted() { const state = seedSchedules(now); const estimate = demoEstimate(now, DEMO_PLACES[0], DEMO_PLACES[3], demoId(300)); return { ...state, estimates: [...state.estimates, estimate] }; }
const body = (patch = {}) => ({ estimateId: demoId(300), optionId: "go", scheduledAt: new Date(now + 3 * DAY).toISOString(), timezone: "Africa/Lagos", ...patch });
const find = (state, bookingId = id) => state.trips.find((trip) => trip.id === bookingId);

test("simulation cannot run in production even on localhost", () => {
  for (const host of ["localhost", "127.0.0.1", "::1", "[::1]"]) { assert.equal(localScheduleDemo("development", host), true); for (const mode of ["production", "test", undefined]) assert.equal(localScheduleDemo(mode, host), false); }
  for (const host of ["app.freebus.cloud", "localhost.evil.test", "192.168.1.2", ""]) assert.equal(localScheduleDemo("development", host), false);
});
test("seed and created bookings conform to the documented response, with a locked fare", () => {
  for (const trip of seedSchedules(now).trips) assert.doesNotThrow(() => bookingSchema.parse(trip));
  const next = createSchedule(quoted(), body(), demoId(400)), trip = find(next, demoId(400));
  assert.equal(trip.status, "OPEN"); assert.equal(trip.driverId, null); assert.equal(trip.version, 1);
  assert.equal(trip.fareLocked, true); assert.equal(trip.fare.isEstimate, false);
  assert.deepEqual(trip.fare.range.low, trip.total); assert.deepEqual(trip.fare.range.high, trip.total);
  assert.equal(trip.fare.waiting.perMinute.amountMinor, 0); assert.equal(next.notices[0].audience, "driver");
});
test("pickup window is inclusive at one hour and thirty days; no shared bookings", () => {
  for (const delta of [HOUR, 30 * DAY]) assert.doesNotThrow(() => createSchedule(quoted(), body({ scheduledAt: new Date(now + delta).toISOString() }), demoId(400)));
  for (const delta of [HOUR - 1, 30 * DAY + 1, -1]) assert.throws(() => createSchedule(quoted(), body({ scheduledAt: new Date(now + delta).toISOString() }), demoId(400)));
  assert.throws(() => createSchedule(quoted(), body({ optionId: "share" }), demoId(400)));
  assert.doesNotThrow(() => createSchedule(quoted(), body({ optionId: "go" }), demoId(400)), "unavailable-now private options can be scheduled");
});
test("an identical create retry is safe even after estimate expiry; changed parameters conflict", () => {
  const created = createSchedule(quoted(), body(), demoId(400));
  const late = { ...created, now: now + HOUR };
  assert.equal(createSchedule(late, body(), demoId(401)), late);
  assert.throws(() => createSchedule(late, body({ optionId: "comfort" }), demoId(401)));
  assert.throws(() => createSchedule({ ...quoted(), now: now + 6 * 60_000 }, body(), demoId(400)));
  assert.throws(() => createSchedule(quoted(), { ...body(), passengerId: demoId(1) }, demoId(400)));
});
test("reviewed version is required; first driver wins; same-driver lost-response retry is safe", () => {
  const state = seedSchedules(now), reserved = acceptSchedule(state, id, a, 1);
  assert.equal(find(reserved).driverId, a); assert.equal(find(reserved).status, "RESERVED");
  assert.equal(find(reserved).rideId, null); assert.equal(acceptSchedule(reserved, id, a, 1), reserved);
  assert.throws(() => acceptSchedule(reserved, id, b, 1));
  assert.throws(() => acceptSchedule(state, id, a, 0));
  assert.throws(() => acceptSchedule({ ...state, now: now + DAY }, id, a, 1));
});
test("rescheduling releases driver and increments version without changing fare or places", () => {
  const reserved = acceptSchedule(seedSchedules(now), id, a, 1);
  const next = rescheduleSchedule(reserved, id, { scheduledAt: new Date(now + 3 * DAY).toISOString(), timezone: "Africa/Lagos" });
  assert.equal(find(next).status, "OPEN"); assert.equal(find(next).driverId, null);
  assert.deepEqual(find(next).total, find(reserved).total); assert.deepEqual(find(next).pickup, find(reserved).pickup);
  assert.throws(() => acceptSchedule(next, id, b, 1));
  assert.equal(find(acceptSchedule(next, id, b, find(next).version)).driverId, b);
});
test("commitment interval includes duration and saved post-journey buffer", () => {
  let state = acceptSchedule(seedSchedules(now), id, a, 1);
  const estimate = demoEstimate(now, DEMO_PLACES[0], DEMO_PLACES[3], demoId(300)); state = { ...state, estimates: [estimate, ...state.estimates] };
  state = createSchedule(state, body({ scheduledAt: new Date(now + DAY + 45 * 60_000).toISOString() }), demoId(400));
  assert.throws(() => acceptSchedule(state, demoId(400), b, 1), /conflicts/);
});
test("driver release reopens a future booking, but expires it after pickup", () => {
  const state = acceptSchedule(seedSchedules(now), id, a, 1);
  assert.throws(() => releaseSchedule(state, id, b, "Unavailable"));
  assert.equal(find(releaseSchedule(state, id, a, "Unavailable")).status, "OPEN");
  assert.equal(find(releaseSchedule({ ...state, now: now + DAY }, id, a, "Unavailable")).status, "EXPIRED");
});
test("worker activates 15 minutes before pickup and never creates a second live ride", () => {
  const state = acceptSchedule(seedSchedules(now), id, a, 1), activation = now + DAY - 15 * 60_000;
  assert.equal(find(matchDueSchedules(state, activation - 1)).status, "RESERVED");
  const active = matchDueSchedules(state, activation);
  assert.equal(find(active).status, "ACTIVATED"); assert.ok(find(active).rideId);
  assert.equal(find(matchDueSchedules(active, activation + HOUR)).rideId, find(active).rideId);
  assert.equal(matchDueSchedules(active, activation + HOUR).notices.length, active.notices.length);
  assert.equal(find(completeDemoSchedule(active, id)).status, "COMPLETED");
  assert.throws(() => cancelSchedule(active, id, "Changed plans"));
});
test("unclaimed requests expire at pickup; busy reservations expire after ten-minute grace", () => {
  assert.equal(find(matchDueSchedules(seedSchedules(now), now + DAY)).status, "EXPIRED");
  const state = acceptSchedule(seedSchedules(now), id, a, 1);
  assert.equal(find(matchDueSchedules(state, now + DAY + 10 * 60_000, true)).status, "RESERVED");
  assert.equal(find(matchDueSchedules(state, now + DAY + 10 * 60_000 + 1, true)).status, "EXPIRED");
  assert.throws(() => matchDueSchedules(state, now - 1));
});
test("required reasons use UTF-8 byte limits, and closed bookings cannot be claimed", () => {
  assert.throws(() => reasonSchema.parse({ reason: "  " }));
  assert.doesNotThrow(() => reasonSchema.parse({ reason: "😀".repeat(500) }));
  assert.throws(() => reasonSchema.parse({ reason: "😀".repeat(501) }));
  const state = cancelSchedule(seedSchedules(now), id, "  Changed plans  ");
  assert.equal(find(state).cancellationReason, "Changed plans");
  assert.throws(() => acceptSchedule(state, id, a, 1));
});
test("timezone conversion is independent of device zone and rejects ambiguous or skipped DST times", () => {
  assert.equal(resolveScheduleTime("2026-10-23T10:00", "Africa/Lagos"), "2026-10-23T09:00:00.000Z");
  assert.equal(localScheduleTime("2026-10-23T09:00:00Z", "Africa/Lagos"), "2026-10-23T10:00");
  assert.throws(() => resolveScheduleTime("2026-03-08T02:30", "America/New_York"));
  assert.throws(() => resolveScheduleTime("2026-11-01T01:30", "America/New_York"));
  assert.throws(() => resolveScheduleTime("2026-02-31T10:00", "Africa/Lagos"));
  assert.throws(() => validateBookingTime({ scheduledAt: "2026-10-23T10:00", timezone: "Africa/Lagos" }, now));
});
test("booking versions reject stale and duplicate snapshots", () => {
  const first = find(seedSchedules(now)), newer = { ...first, version: 4, status: "CANCELLED" };
  assert.equal(preferNewerBooking(newer, first), newer);
  assert.equal(preferNewerBooking(newer, { ...newer }), newer);
});
