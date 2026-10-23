import test from "node:test";
import assert from "node:assert/strict";
import { createScheduleService, ScheduleApiError } from "../src/features/paid-rides/scheduling/schedule-service.ts";
import { seedSchedules, demoId } from "../src/features/paid-rides/scheduling/scheduled-trips.ts";
import { bookingSchema } from "../src/features/paid-rides/scheduling/contract.ts";
import { mapScheduledEvent, scheduledSocketUrl } from "../src/features/paid-rides/scheduling/scheduled-events.ts";
const now = Date.parse("2026-10-22T09:00:00Z"), booking = bookingSchema.parse(seedSchedules(now).trips[0]);
const input = { estimateId: demoId(300), optionId: "go", scheduledAt: "2026-10-23T10:00:00+01:00", timezone: "Africa/Lagos" };
function setup(response = booking) { const calls = [];const api = createScheduleService(async (path, options) => { calls.push({ path, ...options });return Response.json(response); });return { api, calls }; }

test("create sends only the four documented fields and reads a direct booking", async () => {
  const { api, calls } = setup(); const result = await api.create(input);
  assert.equal(result.id, booking.id); assert.equal(calls[0].path, "rides/scheduled");
  assert.equal(calls[0].method, "POST"); assert.deepEqual(JSON.parse(calls[0].body), input);
  assert.equal(calls[0].headers["Content-Type"], "application/json");
  await assert.rejects(() => api.create({ ...input, pickup: booking.pickup }));
  assert.equal(calls.length, 1);
});
test("list parameters encode offsets correctly and never send unsupported fields", async () => {
  const { api, calls } = setup({ items: [booking], nextCursor: null, total: 1 });
  await api.listDriver({ mine: true, status: "RESERVED", limit: 25, from: input.scheduledAt });
  const url = new URL(calls[0].path, "https://example.test/");
  assert.equal(url.searchParams.get("from"), input.scheduledAt); assert.ok(calls[0].path.includes("%2B01")); assert.equal(url.searchParams.get("mine"), "true");
  await api.listBookings({ mine: true, cursor: demoId(50), limit: 100 });
  assert.equal(new URL(calls[1].path, "https://example.test").searchParams.has("mine"), false);
  await assert.rejects(() => api.listDriver({ q: "not-supported" }));
  await assert.rejects(() => api.listDriver({ status: "OPEN,RESERVED" }));
  await assert.rejects(() => api.listDriver({ limit: 101 }));
  await assert.rejects(() => api.listDriver({ from: "2026-10-24T00:00:00Z", to: "2026-10-23T00:00:00Z" }));
});
test("accept uses reviewed version, while patch and cancellation use exact documented endpoints", async () => {
  const { api, calls } = setup();
  await api.accept(booking.id, 7); await api.reschedule(booking.id, { scheduledAt: input.scheduledAt, timezone: input.timezone });
  await api.cancelPassenger(booking.id, " Changed plans "); await api.release(booking.id, " Unavailable ");
  assert.equal(calls[0].path, `driver/scheduled-requests/${booking.id}/accept`);assert.deepEqual(JSON.parse(calls[0].body), { version: 7 });
  assert.equal(calls[1].method, "PATCH"); assert.equal(calls[1].path, `rides/scheduled/${booking.id}`);
  assert.deepEqual(JSON.parse(calls[2].body), { reason: "Changed plans" });assert.equal(calls[3].path, `driver/scheduled-requests/${booking.id}/cancel`);
  await assert.rejects(() => api.release(booking.id, " ")); await assert.rejects(() => api.accept("bad/id", 1));
});
test("409 is not retried automatically, and uncertain create retry keeps the same estimate", async () => {
  let calls = 0;
  const conflict = createScheduleService(async () => { calls++;return Response.json({ code: "scheduling_conflict", message: "Conflicting booking or active journey" }, { status: 409 }); });
  await assert.rejects(() => conflict.accept(booking.id, 1), (error) => error instanceof ScheduleApiError && error.status === 409 && !error.uncertain);
  assert.equal(calls, 1);
  const bodies = [];
  const flaky = createScheduleService(async (_path, options) => { bodies.push(options.body); if (bodies.length === 1) throw new TypeError("network"); return Response.json(booking); });
  await assert.rejects(() => flaky.create(input), (error) => error.uncertain === true);
  await flaky.create(input); assert.equal(bodies[0], bodies[1]);
});
test("plain-text errors, malformed successful responses and cancellation stay safe", async () => {
  const plain = createScheduleService(async () => new Response("Invalid JSON input", { status: 400 }));
  await assert.rejects(() => plain.create(input), (error) => error instanceof ScheduleApiError && error.status === 400);
  const malformed = createScheduleService(async () => Response.json({ data: booking }));
  await assert.rejects(() => malformed.create(input), (error) => error.uncertain === true);
  const ctrl = new AbortController();ctrl.abort();
  const aborted = createScheduleService(async () => { throw new DOMException("Cancelled", "AbortError"); });
  await assert.rejects(() => aborted.create(input, ctrl.signal), { name: "AbortError" });
});
test("scheduled events tolerate seq zero and ID-less resync hints, and use the root socket", () => {
  const frame = { id: "event-1", seq: 0, occurredAt: new Date(now).toISOString(), payload: { type: "scheduled.reserved", booking } };
  assert.equal(mapScheduledEvent(frame).booking.id, booking.id);
  assert.equal(mapScheduledEvent(frame).scheduledRideId, booking.id);
  assert.equal(mapScheduledEvent({ ...frame, payload: { type: "scheduled.resync_required" } }).scheduledRideId, undefined);
  assert.equal(mapScheduledEvent({ ...frame, payload: { type: "ride.updated" } }), null);
  assert.equal(scheduledSocketUrl("https://api.example.test/api/v1"), "wss://api.example.test/rides/ws");
  assert.throws(() => scheduledSocketUrl("https://secret@example.test/api/v1"));
});


test("documented optional fields can be omitted without losing bookings or breaking pagination", async () => {
  for (const status of ["OPEN", "RESERVED", "ACTIVATED", "COMPLETED", "CANCELLED", "EXPIRED"]) {
    const wire = { ...booking, status, futureField: "forward compatible" };
    delete wire.driverId; delete wire.rideId; delete wire.cancellationReason;
    const { api, calls } = setup({ items: [wire], total: 1 });
    const page = await api.listBookings();
    assert.equal(calls[0].path, "rides/scheduled");
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0].status, status);
    assert.equal(page.items[0].driverId, null);
    assert.equal(page.items[0].rideId, null);
    assert.equal(page.items[0].cancellationReason, null);
    assert.equal(page.nextCursor, null);
  }
});

test("optional normalization preserves explicit references and still rejects unusable booking data", async () => {
  const full = { ...booking, status: "ACTIVATED", driverId: demoId(2), rideId: demoId(500), cancellationReason: "A supplied reason" };
  const { api } = setup({ items: [full], total: 2, nextCursor: demoId(600) });
  const page = await api.listBookings();
  assert.equal(page.items[0].driverId, full.driverId);
  assert.equal(page.items[0].rideId, full.rideId);
  assert.equal(page.items[0].cancellationReason, full.cancellationReason);
  assert.equal(page.nextCursor, demoId(600));
  const invalid = setup({ ...booking, total: { amountMinor: "not a number", currency: "NGN" } }).api;
  await assert.rejects(() => invalid.get(booking.id), (error) => error instanceof ScheduleApiError && error.uncertain);
});

test("nullable place metadata and arbitrary fare/option JSON match the supplied DTO", async () => {
  const place = { name: "A place", point: { lat: 9.05, lng: 7.49 }, id: null, secondary: null, source: null };
  for (const value of [null, {}, [], "a backend value", 42, { name: "Comfort", backendField: true }]) {
    const wire = { ...booking, pickup: place, destination: place, fare: value, option: value };
    const { api } = setup({ items: [wire], total: 1 });
    const result = (await api.listBookings()).items[0];
    assert.deepEqual(result.fare, value); assert.deepEqual(result.option, value);
    assert.equal(result.pickup.id, undefined); assert.equal(result.pickup.secondary, undefined); assert.equal(result.pickup.source, undefined);
    assert.equal(result.destination.name, place.name);
    const event = mapScheduledEvent({ id: `nullable-${JSON.stringify(value)}`, occurredAt: new Date(now).toISOString(), payload: { type: "scheduled.reserved", booking: wire } });
    assert.equal(event.booking.id, booking.id);
  }
});

test("new response status strings remain displayable, and option labels use only text names", async () => {
  const { scheduledOptionName } = await import("../src/features/paid-rides/scheduling/contract.ts");
  const { api } = setup({ ...booking, status: "NEW_BACKEND_STATE" });
  assert.equal((await api.get(booking.id)).status, "NEW_BACKEND_STATE");
  assert.equal(scheduledOptionName({ name: "Comfort", extra: true }), "Comfort");
  for (const value of [null, [], 1, "go", {}, { name: null }, { name: {} }, { name: "  " }]) assert.equal(scheduledOptionName(value), "Private ride");
});
