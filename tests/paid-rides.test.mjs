import test from "node:test";
import assert from "node:assert/strict";
import { compareSnapshot, checkSequence, isNewerLocation } from "../src/features/paid-rides/domain/ride-sync.ts";
import { initialRideSession, rideSessionReducer, upsertMessage } from "../src/features/paid-rides/domain/ride-session.ts";
import { driverSessionReducer, initialDriverSession, offerSecondsLeft } from "../src/features/paid-rides/domain/driver-session.ts";
import { derivePassengerPhase, deriveDriverPhase, emptyDraft } from "../src/features/paid-rides/domain/phases.ts";
import { canTransition, passengerCanCancel, sosAvailable } from "../src/features/paid-rides/domain/ride-status.ts";
import { backoffDelay, classifyFix, shouldTransmit } from "../src/features/paid-rides/domain/location-policy.ts";
import { splitDistance, splitDuration } from "../src/features/paid-rides/domain/format.ts";
import { computeDriverRide, computePassengerRide, passengerStageAt } from "../src/features/paid-rides/services/mock/mock-timeline.ts";
import { mockQuote } from "../src/features/paid-rides/services/mock/mock-pricing.ts";
import { MOCK_DRIVERS, MOCK_PRODUCTS } from "../src/features/paid-rides/services/mock/mock-fixtures.ts";
import {
  mapAvailability,
  mapContact,
  mapEstimate,
  mapRealtimeEvent,
  mapRide,
  mapRideEnvelope,
  mapViewer,
} from "../src/features/paid-rides/services/api-mappers.ts";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const place = (name, lat, lng) => ({ id: name, name, secondary: "Abuja", point: { lat, lng }, source: "search" });
const pickup = place("Wuse Market", 9.0647, 7.4728);
const destination = place("Jabi Lake Mall", 9.0721, 7.4246);
const route = { points: [pickup.point, { lat: 9.068, lng: 7.45 }, destination.point], distanceMeters: 5900, durationSeconds: 540, source: "road" };
const money = (naira) => ({ amountMinor: naira * 100, currency: "NGN" });

function ride(status, version, extra = {}) {
  return {
    id: "ride-1",
    version,
    status,
    createdAt: "2026-10-12T10:00:00.000Z",
    updatedAt: "2026-10-12T10:00:00.000Z",
    pickup,
    destination,
    route,
    option: { id: "prod-go", name: "Go", vehicleClass: "compact", capacity: 4, shared: false },
    fare: { total: money(1900), breakdown: [], isEstimate: true },
    payment: { status: "pending", methodLabel: "Cash" },
    timestamps: {},
    sos: { status: "none" },
    ...extra,
  };
}

let eventCounter = 0;
function event(payload, { seq = null, rideId = "ride-1", id } = {}) {
  eventCounter += 1;
  return { id: id ?? `evt-${eventCounter}`, rideId, seq, rideVersion: null, occurredAt: new Date().toISOString(), payload };
}

const ready = (state = initialRideSession) => rideSessionReducer(state, { type: "BOOTSTRAP_SUCCESS", ride: null });
const run = (reducer, state, ...messages) => messages.reduce(reducer, state);

// ─── Status machine and ordering ─────────────────────────────────────────────

test("the status machine allows re-dispatch but never leaves a finished ride", () => {
  assert.equal(canTransition("DRIVER_EN_ROUTE", "SEARCHING"), true);
  assert.equal(canTransition("IN_PROGRESS", "DRIVER_EN_ROUTE"), false);
  assert.equal(canTransition("COMPLETED", "IN_PROGRESS"), false);
  assert.equal(passengerCanCancel("DRIVER_ARRIVED"), true);
  assert.equal(passengerCanCancel("IN_PROGRESS"), false);
  assert.equal(sosAvailable("SEARCHING"), false);
  assert.equal(sosAvailable("IN_PROGRESS"), true);
});

test("snapshots apply only when newer; versions win over status rank", () => {
  assert.equal(compareSnapshot(ride("DRIVER_EN_ROUTE", 5), ride("IN_PROGRESS", 6)), "apply");
  assert.equal(compareSnapshot(ride("IN_PROGRESS", 6), ride("DRIVER_EN_ROUTE", 5)), "stale");
  assert.equal(compareSnapshot(ride("IN_PROGRESS", 6), ride("IN_PROGRESS", 6)), "stale");
  // A legitimate re-dispatch carries a higher version and is accepted.
  assert.equal(compareSnapshot(ride("DRIVER_EN_ROUTE", 5), ride("SEARCHING", 7)), "apply");
  assert.equal(compareSnapshot(ride("SEARCHING", 1), { ...ride("SEARCHING", 1), id: "other" }), "different-ride");
});

test("without versions, status never regresses and terminal states stick", () => {
  const unversioned = (status) => ({ ...ride(status, 0), version: Number.NaN });
  assert.equal(compareSnapshot(unversioned("IN_PROGRESS"), unversioned("DRIVER_EN_ROUTE")), "stale");
  assert.equal(compareSnapshot(unversioned("DRIVER_EN_ROUTE"), unversioned("IN_PROGRESS")), "apply");
  assert.equal(compareSnapshot(unversioned("COMPLETED"), unversioned("IN_PROGRESS")), "stale");
});

test("sequence checks drop duplicates and detect gaps", () => {
  const seen = ["evt-a"];
  assert.equal(checkSequence(3, seen, event({ type: "chat.typing.started" }, { id: "evt-a", seq: 4 })).duplicate, true);
  assert.equal(checkSequence(3, [], event({ type: "chat.typing.started" }, { seq: 3 })).duplicate, true);
  assert.deepEqual(checkSequence(3, [], event({ type: "chat.typing.started" }, { seq: 4 })), { duplicate: false, gap: false, nextSeq: 4 });
  assert.equal(checkSequence(3, [], event({ type: "chat.typing.started" }, { seq: 7 })).gap, true);
});

test("older location fixes never move the marker backwards", () => {
  const at = (iso) => ({ point: pickup.point, heading: 0, speedMps: null, accuracyMeters: 5, recordedAt: iso });
  assert.equal(isNewerLocation(at("2026-10-12T10:00:05Z"), at("2026-10-12T10:00:04Z")), false);
  assert.equal(isNewerLocation(at("2026-10-12T10:00:05Z"), at("2026-10-12T10:00:06Z")), true);
});

// ─── Passenger session ───────────────────────────────────────────────────────

test("passenger can request a ride, and a double tap can't request twice", () => {
  let state = ready();
  state = rideSessionReducer(state, { type: "ACTION_START", action: "request" });
  assert.equal(state.pending, "request");
  assert.equal(derivePassengerPhase({ ...emptyDraft, step: "options", pickup, destination }, state), "REQUESTING_RIDE");
  assert.equal(rideSessionReducer(state, { type: "ACTION_START", action: "cancel" }), state, "a second mutation is ignored while one is in flight");
  state = rideSessionReducer(state, { type: "ACTION_SUCCESS", action: "request", ride: ride("SEARCHING", 1) });
  assert.equal(state.pending, null);
  assert.equal(derivePassengerPhase(emptyDraft, state), "SEARCHING_DRIVERS");
});

test("passenger sees no-drivers, then a match arriving over realtime", () => {
  let state = rideSessionReducer(ready(), { type: "SNAPSHOT", ride: ride("SEARCHING", 1) });
  const noDrivers = rideSessionReducer(state, { type: "EVENT", event: event({ type: "ride.updated", ride: ride("NO_DRIVERS", 2) }) });
  assert.equal(derivePassengerPhase(emptyDraft, noDrivers), "NO_DRIVERS_AVAILABLE");

  state = rideSessionReducer(state, { type: "EVENT", event: event({ type: "ride.updated", ride: ride("DRIVER_ASSIGNED", 3, { driver: MOCK_DRIVERS.compact }) }) });
  assert.equal(derivePassengerPhase(emptyDraft, state), "DRIVER_MATCHED");
});

test("a late event cannot pull an active trip back to 'driver en route'", () => {
  let state = rideSessionReducer(ready(), { type: "SNAPSHOT", ride: ride("IN_PROGRESS", 10) });
  state = rideSessionReducer(state, { type: "EVENT", event: event({ type: "ride.updated", ride: ride("DRIVER_EN_ROUTE", 8) }) });
  assert.equal(derivePassengerPhase(emptyDraft, state), "TRIP_ACTIVE");
});

test("duplicate events are applied once, and a sequence gap requests a resync", () => {
  const assigned = event({ type: "chat.message.created", message: { id: "m1", rideId: "ride-1", from: "them", body: "Hi", sentAt: "2026-10-12T10:01:00Z", status: "delivered" } }, { seq: 1, id: "dup" });
  let state = rideSessionReducer(ready(), { type: "SNAPSHOT", ride: ride("DRIVER_EN_ROUTE", 4) });
  state = run(rideSessionReducer, state, { type: "EVENT", event: assigned }, { type: "EVENT", event: assigned });
  assert.equal(state.messages.length, 1);
  assert.equal(state.unread, 1);
  const before = state.resyncToken;
  state = rideSessionReducer(state, { type: "EVENT", event: event({ type: "chat.typing.started" }, { seq: 5 }) });
  assert.equal(state.resyncToken, before + 1);
});

test("cancellations map to who cancelled", () => {
  const byDriver = rideSessionReducer(ready(), { type: "SNAPSHOT", ride: ride("CANCELLED", 9, { cancellation: { by: "driver" } }) });
  assert.equal(derivePassengerPhase(emptyDraft, byDriver), "CANCELLED_BY_DRIVER");
  const byRider = rideSessionReducer(ready(), { type: "SNAPSHOT", ride: ride("CANCELLED", 9, { cancellation: { by: "passenger" } }) });
  assert.equal(derivePassengerPhase(emptyDraft, byRider), "CANCELLED_BY_PASSENGER");
});

test("an active ride is restored after reload from the server, not from memory", () => {
  let state = rideSessionReducer(initialRideSession, { type: "BOOTSTRAP_START" });
  assert.equal(derivePassengerPhase(emptyDraft, state), "RESTORING");
  state = rideSessionReducer(state, { type: "BOOTSTRAP_SUCCESS", ride: ride("DRIVER_ARRIVED", 12, { driver: MOCK_DRIVERS.compact }) });
  assert.equal(derivePassengerPhase(emptyDraft, state), "DRIVER_ARRIVED");
});

test("a finished ride stays on screen for rating when the server stops returning it", () => {
  let state = rideSessionReducer(ready(), { type: "SNAPSHOT", ride: ride("COMPLETED", 20) });
  state = rideSessionReducer(state, { type: "BOOTSTRAP_SUCCESS", ride: null });
  assert.equal(derivePassengerPhase(emptyDraft, state), "TRIP_COMPLETED");
  // …but a ride that was still live locally is dropped when the server has none.
  let live = rideSessionReducer(ready(), { type: "SNAPSHOT", ride: ride("DRIVER_EN_ROUTE", 4) });
  live = rideSessionReducer(live, { type: "BOOTSTRAP_SUCCESS", ride: null });
  assert.equal(live.ride, null);
});

test("chat bubbles reconcile and receipts only move forward", () => {
  const optimistic = { id: "c1", clientId: "c1", rideId: "ride-1", from: "me", body: "Here", sentAt: "2026-10-12T10:02:00Z", status: "sending" };
  let messages = upsertMessage([], optimistic);
  messages = upsertMessage(messages, { ...optimistic, id: "server-1", status: "sent" });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, "server-1");
  let state = rideSessionReducer(ready(), { type: "SNAPSHOT", ride: ride("DRIVER_EN_ROUTE", 4) });
  state = rideSessionReducer(state, { type: "MESSAGES_LOADED", rideId: "ride-1", messages });
  state = run(
    rideSessionReducer,
    state,
    { type: "EVENT", event: event({ type: "chat.message.read", messageId: "server-1" }) },
    { type: "EVENT", event: event({ type: "chat.message.delivered", messageId: "server-1" }) },
  );
  assert.equal(state.messages[0].status, "read");
});

// ─── Driver session ──────────────────────────────────────────────────────────

function offer(id = "offer-1", ttlSeconds = 15) {
  const received = Date.parse("2026-10-12T10:00:00Z");
  return {
    offerId: id,
    rideId: `ride-${id}`,
    expiresAt: new Date(received + ttlSeconds * 1000).toISOString(),
    receivedAt: new Date(received).toISOString(),
    pickup,
    destination,
    pickupDistanceMeters: 1200,
    pickupEtaSeconds: 240,
    tripDistanceMeters: 5900,
    tripDurationSeconds: 540,
    earning: money(1500),
    passenger: { displayName: "Adaeze", rating: 4.9 },
    optionName: "Go",
    vehicleClass: "compact",
    shared: false,
  };
}

const onlineDriver = () =>
  run(
    driverSessionReducer,
    initialDriverSession,
    { type: "RIDE", msg: { type: "BOOTSTRAP_SUCCESS", ride: null } },
    { type: "AVAILABILITY_REQUEST", online: true },
    { type: "AVAILABILITY_CONFIRMED", availability: "ONLINE" },
  );

test("driver receives a request only when online", () => {
  const offline = driverSessionReducer(initialDriverSession, { type: "OFFER_RECEIVED", offer: offer() });
  assert.equal(offline.offer, null);
  const state = driverSessionReducer(onlineDriver(), { type: "RIDE", msg: { type: "EVENT", event: event({ type: "driver.request.received", offer: offer() }, { rideId: null }) } });
  assert.equal(deriveDriverPhase(state), "REQUEST_INCOMING");
});

test("requests expire by server deadline or server event", () => {
  const o = offer("o2", 15);
  assert.equal(offerSecondsLeft(o, Date.parse("2026-10-12T10:00:10Z"), 20), 5);
  assert.equal(offerSecondsLeft({ ...o, expiresAt: null }, Date.parse("2026-10-12T10:00:10Z"), 20), 10, "falls back to config when the server sends no deadline");
  let state = driverSessionReducer(onlineDriver(), { type: "OFFER_RECEIVED", offer: o });
  state = driverSessionReducer(state, { type: "OFFER_TIMED_OUT", offerId: "o2" });
  assert.equal(deriveDriverPhase(state), "REQUEST_UNAVAILABLE");
  assert.equal(state.offer.phase, "expired");

  let viaEvent = driverSessionReducer(onlineDriver(), { type: "OFFER_RECEIVED", offer: offer("o3") });
  viaEvent = driverSessionReducer(viaEvent, { type: "RIDE", msg: { type: "EVENT", event: event({ type: "driver.request.expired", offerId: "o3" }, { rideId: null }) } });
  assert.equal(viaEvent.offer.phase, "expired");
});

test("accepting waits for the server; the authoritative ride starts the trip", () => {
  let state = driverSessionReducer(onlineDriver(), { type: "OFFER_RECEIVED", offer: offer() });
  state = driverSessionReducer(state, { type: "ACCEPT_START", offerId: "offer-1" });
  assert.equal(deriveDriverPhase(state), "REQUEST_ACCEPTING");
  // An expiry event that races the accept doesn't override it.
  state = driverSessionReducer(state, { type: "RIDE", msg: { type: "EVENT", event: event({ type: "driver.request.expired", offerId: "offer-1" }, { rideId: null }) } });
  assert.equal(state.offer.phase, "accepting");
  state = driverSessionReducer(state, { type: "ACCEPT_RESULT", offerId: "offer-1", outcome: "accepted", ride: ride("DRIVER_EN_ROUTE", 1) });
  assert.equal(deriveDriverPhase(state), "EN_ROUTE_TO_PICKUP");
  assert.equal(state.availability, "ON_TRIP");
});

test("an assignment conflict is shown, then the driver is back to waiting", () => {
  let state = driverSessionReducer(onlineDriver(), { type: "OFFER_RECEIVED", offer: offer() });
  state = run(driverSessionReducer, state, { type: "ACCEPT_START", offerId: "offer-1" }, { type: "ACCEPT_RESULT", offerId: "offer-1", outcome: "already_taken" });
  assert.equal(state.offer.phase, "taken");
  assert.equal(state.ride.ride, null);
  state = driverSessionReducer(state, { type: "OFFER_DISMISSED" });
  assert.equal(deriveDriverPhase(state), "ONLINE_WAITING");
});

test("a second request while one is showing is queued, not swapped in", () => {
  let state = run(driverSessionReducer, onlineDriver(), { type: "OFFER_RECEIVED", offer: offer("a") }, { type: "OFFER_RECEIVED", offer: offer("b") });
  assert.equal(state.offer.offer.offerId, "a");
  assert.equal(state.queuedOffer.offerId, "b");
  state = run(driverSessionReducer, state, { type: "DECLINE_START", offerId: "a" }, { type: "DECLINE_DONE", offerId: "a" });
  assert.equal(state.offer.offer.offerId, "b");
});

test("active ride and completion drive availability; going offline mid-trip is refused", () => {
  let state = driverSessionReducer(onlineDriver(), { type: "RIDE", msg: { type: "SNAPSHOT", ride: ride("IN_PROGRESS", 5) } });
  assert.equal(deriveDriverPhase(state), "TRIP_ACTIVE");
  assert.equal(driverSessionReducer(state, { type: "AVAILABILITY_REQUEST", online: false }), state);
  state = driverSessionReducer(state, { type: "RIDE", msg: { type: "SNAPSHOT", ride: ride("COMPLETED", 6) } });
  assert.equal(deriveDriverPhase(state), "TRIP_COMPLETED");
  assert.equal(state.availability, "ONLINE");
});

// ─── Location, backoff and formatting ────────────────────────────────────────

test("location is transmitted on movement or heartbeat, never every fix", () => {
  const policy = { minIntervalMs: 4000, maxIntervalMs: 20000, minDistanceMeters: 15 };
  const last = { point: pickup.point, at: 0 };
  assert.equal(shouldTransmit(null, last, policy), true);
  assert.equal(shouldTransmit(last, { point: { lat: 9.07, lng: 7.4728 }, at: 1000 }, policy), false, "too soon, however far");
  assert.equal(shouldTransmit(last, { point: pickup.point, at: 6000 }, policy), false, "didn't move");
  assert.equal(shouldTransmit(last, { point: { lat: 9.0649, lng: 7.4728 }, at: 6000 }, policy), true, "moved ~22 m");
  assert.equal(shouldTransmit(last, { point: pickup.point, at: 21000 }, policy), true, "heartbeat");
  assert.equal(classifyFix({ accuracyMeters: 300, timestamp: 1000 }, 2000, { maxFixAgeMs: 30000, lowAccuracyMeters: 120 }), "low-accuracy");
  assert.equal(classifyFix({ accuracyMeters: 10, timestamp: 0 }, 60000, { maxFixAgeMs: 30000, lowAccuracyMeters: 120 }), "stale");
});

test("reconnect backoff grows, stays capped and jittered", () => {
  const options = { baseDelayMs: 1000, maxDelayMs: 30000, jitterRatio: 0.3 };
  assert.equal(backoffDelay(0, options, () => 0.5), 1000);
  assert.equal(backoffDelay(3, options, () => 0.5), 8000);
  assert.equal(backoffDelay(20, options, () => 1), 30000);
  assert.ok(backoffDelay(2, options, () => 0) >= 2800);
});

test("ETA rounds up and distances read naturally", () => {
  assert.deepEqual(splitDuration(70), { value: "2", unit: "min", spoken: "2 minutes" });
  assert.equal(splitDuration(20).spoken, "under a minute");
  assert.equal(splitDistance(1840).value, "1.8");
  assert.equal(splitDistance(240).unit, "m");
});

// ─── Mock simulation ─────────────────────────────────────────────────────────

const t0 = Date.parse("2026-10-12T10:00:00Z");
function plan(overrides = {}) {
  return {
    rideId: "ride-sim",
    createdAt: t0,
    requestedAt: t0,
    scenario: "normal",
    pickup,
    destination,
    route,
    option: { id: "prod-go", name: "Go", vehicleClass: "compact", capacity: 4, shared: false },
    fare: mockQuote(MOCK_PRODUCTS[0], route),
    paymentLabel: "Cash",
    driver: MOCK_DRIVERS.compact,
    approachRoute: { points: [{ lat: 9.07, lng: 7.48 }, pickup.point], distanceMeters: 1500, durationSeconds: 240, source: "road" },
    durations: { searchMs: 5000, assignedMs: 2000, approachMs: 30000, waitMs: 9000, tripMs: 60000 },
    sos: "none",
    ...overrides,
  };
}

test("the simulated server walks the whole lifecycle and versions only grow", () => {
  const seen = [];
  let lastVersion = 0;
  for (let ms = 0; ms <= 120000; ms += 500) {
    const r = computePassengerRide(plan(), t0 + ms);
    assert.ok(r.version >= lastVersion, `version went backwards at ${ms}ms`);
    lastVersion = r.version;
    if (seen.at(-1) !== r.status) seen.push(r.status);
  }
  assert.deepEqual(seen, ["REQUESTED", "SEARCHING", "DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVING", "DRIVER_ARRIVED", "IN_PROGRESS", "COMPLETED"]);
});

test("the simulation is a pure function of time, so a reload rebuilds the same ride", () => {
  const at = t0 + 20000;
  assert.deepEqual(computePassengerRide(plan(), at), computePassengerRide(structuredClone(plan()), at));
  assert.equal(passengerStageAt(plan(), at).stage, "APPROACH");
});

test("scenarios: no drivers, driver cancels, and a passenger cancellation freezes the ride", () => {
  assert.equal(computePassengerRide(plan({ scenario: "no-drivers" }), t0 + 60000).status, "NO_DRIVERS");
  const cancelled = computePassengerRide(plan({ scenario: "driver-cancels" }), t0 + 60000);
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.cancellation.by, "driver");
  const frozen = plan({ cancelledAt: t0 + 3000, cancelledBy: "passenger" });
  assert.deepEqual(computePassengerRide(frozen, t0 + 10000), computePassengerRide(frozen, t0 + 90000));
});

test("the simulated driver trip follows the driver's own actions", () => {
  const assignment = {
    rideId: "ride-d",
    offer: offer(),
    acceptedAt: t0,
    approachRoute: { points: [{ lat: 9.07, lng: 7.48 }, pickup.point], distanceMeters: 1500, durationSeconds: 240, source: "road" },
    tripRoute: route,
    approachMs: 30000,
    tripMs: 60000,
    passenger: { displayName: "Adaeze", contact: { call: "masked", chat: true } },
    fare: mockQuote(MOCK_PRODUCTS[0], route),
    earning: money(1500),
  };
  assert.equal(computeDriverRide(assignment, t0 + 5000).status, "DRIVER_EN_ROUTE");
  assert.equal(computeDriverRide({ ...assignment, arrivedAt: t0 + 31000 }, t0 + 32000).status, "DRIVER_ARRIVED");
  const trip = { ...assignment, arrivedAt: t0 + 31000, startedAt: t0 + 40000 };
  assert.equal(computeDriverRide(trip, t0 + 50000).status, "IN_PROGRESS");
  assert.equal(computeDriverRide({ ...trip, completedAt: t0 + 90000 }, t0 + 95000).status, "COMPLETED");
  assert.equal(computeDriverRide({ ...assignment, passengerCancelsAt: t0 + 12000 }, t0 + 15000).status, "CANCELLED");
});

test("fare lines always add up to the quoted total", () => {
  for (const product of MOCK_PRODUCTS) {
    const quote = mockQuote(product, route);
    const sum = quote.breakdown.reduce((total, line) => total + line.amount.amountMinor, 0);
    assert.equal(sum, quote.total.amountMinor, product.name);
  }
});

// ─── Real backend mapping (docs/paid-rides/openapi.json) ─────────────────────

test("viewer roles map case-insensitively; everyone signed in can ride", () => {
  assert.deepEqual(mapViewer({ displayName: "Ada", roles: ["User"] }).roles, ["passenger"]);
  assert.deepEqual(mapViewer({ displayName: "Bayo", roles: ["Driver"] }).roles, ["passenger", "driver"]);
  assert.deepEqual(mapViewer({ displayName: "Chi", roles: ["driver", "Admin"] }).roles, ["passenger", "driver"]);
  assert.throws(() => mapViewer({ displayName: "Dupe" }), { code: "unavailable" }, "a malformed viewer must not authorize a session");
});

test("availability envelope and calling capability are read defensively", () => {
  assert.equal(mapAvailability({ availability: { status: "ON_TRIP", updatedAt: "2026-10-15T12:00:00Z" } }), "ON_TRIP");
  assert.equal(mapAvailability({ availability: "online" }), "ONLINE");
  assert.equal(mapAvailability(null), "OFFLINE");
  assert.deepEqual(mapContact({ call: "masked", chat: false }), { call: "none", callHref: undefined, chat: false }, "no href, no call button");
  assert.equal(mapContact({ call: "direct", callHref: "tel:+234", chat: false }).call, "direct");
  assert.equal(mapContact({ call: "carrier-pigeon", callHref: "tel:+234" }).call, "none");
});

test("estimate maps options, unavailable products and the waiting policy", () => {
  const ngn = (amountMinor) => ({ amountMinor, currency: "NGN" });
  const estimate = mapEstimate(
    {
      estimateId: "est-1",
      expiresAt: "2026-10-15T12:05:00Z",
      defaultPaymentMethodId: "cash",
      paymentMethods: [{ id: "cash", kind: "Cash", label: "Cash" }],
      route: { name: "a Free Bus route by mistake", stops: [] },
      options: [
        {
          available: true,
          pickupEtaSeconds: 240,
          option: { id: "standard", name: "Standard", description: "Everyday", vehicleClass: "Sedan", capacity: 4, shared: false },
          fare: { total: ngn(350000), range: { low: ngn(320000), high: ngn(380000) }, breakdown: [{ code: "base", label: "Base", amount: ngn(50000) }], isEstimate: true, waiting: { freeMinutes: 3, perMinute: ngn(5000) } },
        },
        {
          available: false,
          option: { id: "xl", name: "XL", description: "", vehicleClass: "van", capacity: 6, shared: false },
          fare: { total: ngn(600000), range: { low: ngn(600000), high: ngn(600000) }, breakdown: [], isEstimate: true, waiting: { freeMinutes: 3, perMinute: ngn(5000) } },
        },
      ],
    },
    { pickup, destination },
  );
  assert.equal(estimate.estimateId, "est-1");
  assert.equal(estimate.options[0].vehicleClass, "sedan");
  assert.equal(estimate.options[0].fare.waiting.freeMinutes, 3);
  assert.equal(estimate.options[1].available, false);
  assert.equal(estimate.options[1].fare.range, undefined, "a zero-width range is a fixed price");
  assert.equal(estimate.paymentMethods[0].kind, "cash");
  assert.equal(estimate.route.source, "approximate", "an unexpected route shape falls back to a straight line");
  assert.deepEqual(estimate.route.points, [pickup.point, destination.point]);
});

test("ride projection keeps the ride route shape and the waiting charge", () => {
  const ngn = (amountMinor) => ({ amountMinor, currency: "NGN" });
  const wire = {
    id: "ride-9",
    version: 4,
    status: "DRIVER_ARRIVED",
    createdAt: "2026-10-15T12:00:00Z",
    updatedAt: "2026-10-15T12:06:00Z",
    pickup: { name: "Wuse Market", point: { lat: 9.0647, lng: 7.4728 } },
    destination: { name: "Jabi Lake Mall", point: { lat: 9.0721, lng: 7.4246 } },
    route,
    option: { id: "standard", name: "Standard", vehicleClass: "sedan", capacity: 4, shared: false, description: "" },
    fare: { total: ngn(350000), range: { low: ngn(320000), high: ngn(380000) }, breakdown: [], isEstimate: true, waiting: { freeMinutes: 3, perMinute: ngn(5000) } },
    payment: { methodLabel: "Cash", status: "Pending" },
    driver: { displayName: "Musa", verified: true, completedRides: 120, contact: { call: "none", chat: false }, vehicle: { make: "Toyota", model: "Corolla", color: "Silver", plate: "ABC-123", vehicleClass: "sedan", capacity: 4 } },
    cancellation: null,
    timestamps: { arrivedAt: "2026-10-15T12:05:00Z" },
    sos: { status: "none" },
    waiting: { billableMinutes: 2, charge: ngn(10000), freeSeconds: 180, freeUntil: "2026-10-15T12:08:00Z", perMinute: ngn(5000), waitedSeconds: 300 },
  };
  const mapped = mapRide(wire);
  assert.equal(mapped.version, 4);
  assert.equal(mapped.route.source, "road");
  assert.equal(mapped.route.points.length, 3);
  assert.equal(mapped.payment.status, "pending");
  assert.equal(mapped.pickup.secondary, "");
  assert.equal(mapped.driver.contact.call, "none");
  assert.equal(mapped.waiting.charge.amountMinor, 10000);
  assert.equal(mapped.cancellation, undefined);
  assert.equal(mapRideEnvelope({ ride: null }), null);
  assert.equal(mapRideEnvelope({ ride: wire }).id, "ride-9");
});

test("socket events: seq is ignored for this backend, so repeats are not dropped and jumps don't resync", () => {
  const frame = (id, seq, payload) => ({ id, rideId: "ride-1", seq, rideVersion: null, occurredAt: "2026-10-15T12:00:00Z", payload });
  const location = (second) => ({ type: "ride.driver.location_updated", location: { point: { lat: 9.06 + second / 1000, lng: 7.47 }, recordedAt: `2026-10-15T12:00:0${second}Z` } });
  const a = mapRealtimeEvent(frame("evt-a", 1, location(1)), { trustSeq: false });
  const b = mapRealtimeEvent(frame("evt-b", 1, location(2)), { trustSeq: false });
  const c = mapRealtimeEvent(frame("evt-c", 7, location(3)), { trustSeq: false });
  assert.equal(a.seq, null);
  assert.equal(mapRealtimeEvent(frame("evt-z", 3, location(0)), { trustSeq: true }).seq, 3);
  assert.equal(mapRealtimeEvent(frame("evt-x", 1, { type: "chat.typing.started" }), { trustSeq: false }), null, "unknown events are dropped");

  let state = rideSessionReducer(ready(), { type: "SNAPSHOT", ride: ride("DRIVER_EN_ROUTE", 2) });
  for (const e of [a, b, a, c]) state = rideSessionReducer(state, { type: "EVENT", event: e });
  assert.equal(state.seenEventIds.length, 3, "same id applied once; repeated seq still applied");
  assert.equal(state.resyncToken, 0, "a seq jump is not treated as missed events");
  assert.equal(state.ride.driverLocation.recordedAt, "2026-10-15T12:00:03Z");
});

test("an expiry without an offer id is matched by the event's ride", () => {
  const raw = mapRealtimeEvent({ id: "evt-exp", rideId: "ride-o9", seq: 1, occurredAt: "2026-10-15T12:00:20Z", payload: { type: "driver.request.expired" } }, { trustSeq: false });
  let state = driverSessionReducer(onlineDriver(), { type: "OFFER_RECEIVED", offer: offer("o9") });
  state = driverSessionReducer(state, { type: "RIDE", msg: { type: "EVENT", event: raw } });
  assert.equal(state.offer.phase, "expired");

  const offerEvent = mapRealtimeEvent(
    { id: "evt-offer", rideId: "r-2", seq: 1, occurredAt: "2026-10-15T12:00:00Z", payload: { type: "driver.request.received", offer: { offerId: "o-2", rideId: "r-2", expiresAt: "2026-10-15T12:00:20Z", pickup: { name: "HQ", point: { lat: 6.52, lng: 3.37 } }, destination: { name: "Airport", point: { lat: 6.57, lng: 3.32 } }, option: { id: "standard", name: "Standard", vehicleClass: "sedan", capacity: 4, shared: false }, fare: { total: { amountMinor: 350000, currency: "NGN" } }, driverEarning: { amountMinor: 300000, currency: "NGN" }, tripDistanceMeters: 14200, tripDurationSeconds: 1800, passenger: { displayName: "Grace A.", rating: 4.9 } } } },
    { trustSeq: false },
  );
  assert.equal(offerEvent.payload.offer.earning.amountMinor, 300000);
  assert.equal(offerEvent.payload.offer.pickupDistanceMeters, 0, "missing pickup distance degrades to zero");
  assert.equal(offerEvent.payload.offer.passenger.displayName, "Grace A.");
});
