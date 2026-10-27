import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import ts from "typescript";
import { create } from "zustand";
import { accountSession, accountResult } from "../src/lib/account-session.ts";
import * as errors from "../src/features/paid-rides/domain/errors.ts";
import * as phases from "../src/features/paid-rides/domain/phases.ts";
import * as rideSession from "../src/features/paid-rides/domain/ride-session.ts";
import * as driverSession from "../src/features/paid-rides/domain/driver-session.ts";
import * as rideStatus from "../src/features/paid-rides/domain/ride-status.ts";

// Execute the actual stores with injected network adapters, without browser or live API writes.
function loadStore(name, service) {
  const file = new URL(`../src/features/paid-rides/state/${name}-store.ts`, import.meta.url);
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const dependencies = {
    zustand: { create }, "@/lib/account-session": { accountSession, accountResult },
    "../domain/errors": errors, "../domain/phases": phases, "../domain/ride-session": rideSession,
    "../domain/driver-session": driverSession, "../analytics": { trackRideEvent() {} },
    "../domain/ride-status": rideStatus,
    "../services": { getRideService: () => service, newIdempotencyKey: () => crypto.randomUUID() },
    "./dismissed-rides": { withoutDismissed: (ride) => ride, dismissRideLocally() {} },
    "./preferences-store": { rememberRecentPlace() {} },
  };
  const storeModule = new Module(file.pathname);
  storeModule.require = (specifier) => { if (!(specifier in dependencies)) throw new Error(`Unexpected dependency: ${specifier}`); return dependencies[specifier]; };
  storeModule._compile(compiled, file.pathname);
  return storeModule.exports[name === "passenger" ? "usePassengerStore" : "useDriverStore"];
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test("passenger request result and errors from a previous login cannot restore its ride or draft", async () => {
  for (const failed of [false, true]) {
    accountSession.replace(false); const gate = deferred();
    const store = loadStore("passenger", { requestRide: () => gate.promise });
    store.getState().setDraft({ pickup: { id: "A-home" }, destination: { id: "A-work" }, optionId: "standard" });
    const pending = store.getState().requestRide({ estimateId: "quote-A" });
    accountSession.replace(true); accountSession.replace(false);
    if (failed) gate.reject(new Error("old failure")); else gate.resolve({ id: "ride-A", status: "SEARCHING", version: 1 });
    await pending;
    assert.equal(store.getState().session.ride, null);
    assert.equal(store.getState().draft.pickup, null);
    assert.deepEqual(store.getState().session, rideSession.initialRideSession);
  }
});

test("old driver availability cannot mark the new account online", async () => {
  accountSession.replace(false); const gate = deferred();
  const store = loadStore("driver", { setDriverAvailability: () => gate.promise });
  const pending = store.getState().setOnline(true);
  accountSession.replace(false); gate.resolve("ONLINE"); await pending;
  assert.deepEqual(store.getState().state, driverSession.initialDriverSession);
});

test("an old refresh finishing cannot clear a newer account's in-flight refresh", async () => {
  accountSession.replace(false); const old = deferred(), fresh = deferred(); let calls = 0;
  const store = loadStore("passenger", { getCurrentRide: () => (++calls === 1 ? old.promise : fresh.promise) });
  const a = store.getState().refreshCurrentRide(); accountSession.replace(false);
  const b = store.getState().refreshCurrentRide(); old.resolve({ id: "A" }); await a;
  assert.equal(store.getState().refreshCurrentRide(), b); assert.equal(calls, 2);
  fresh.resolve(null); await b; assert.equal(store.getState().session.ride, null);
});

test("fresh logins do not restore old ride outcomes, including on later focus refreshes", async () => {
  for (const status of ["NO_DRIVERS", "COMPLETED", "CANCELLED"]) {
    accountSession.replace(false);
    const store = loadStore("passenger", { getCurrentRide: async () => ({ id: "old-request", status, version: 1 }) });
    await store.getState().refreshCurrentRide();
    await store.getState().refreshCurrentRide();
    assert.equal(store.getState().session.ride, null);
    assert.equal(store.getState().draft.optionId, null);
    assert.equal(phases.derivePassengerPhase(store.getState().draft, store.getState().session), "IDLE");
  }
});

test("live rides restore after login and can still show their new outcome", async () => {
  for (const status of ["SEARCHING", "DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "IN_PROGRESS", "PAUSED"]) {
    accountSession.replace(false);
    let current = { id: "active-request", status, version: 1 };
    const store = loadStore("passenger", { getCurrentRide: async () => current });
    await store.getState().refreshCurrentRide();
    assert.equal(store.getState().session.ride.id, current.id);
    current = { ...current, status: "COMPLETED", version: 2 };
    await store.getState().refreshCurrentRide();
    assert.equal(store.getState().session.ride.status, "COMPLETED");
  }
});

test("a selected ride option and route are cleared when the account session changes", () => {
  accountSession.replace(false);
  const store = loadStore("passenger", {});
  store.getState().setDraft({ step: "options", optionId: "comfort", pickup: { id: "old-pickup" }, destination: { id: "old-destination" } });
  accountSession.replace(true);
  accountSession.replace(false);
  assert.deepEqual(store.getState().draft, phases.emptyDraft);
});

test("replayed socket outcomes cannot relock a fresh login, but live assignments still restore", () => {
  accountSession.replace(false);
  const store = loadStore("passenger", {});
  const update = (id, status, version = 1) => ({ type: "EVENT", event: { id: `${id}-${status}`, rideId: id, seq: null, occurredAt: new Date().toISOString(), payload: { type: "ride.updated", ride: { id, status, version } } } });
  for (const status of ["NO_DRIVERS", "COMPLETED", "CANCELLED"]) {
    store.getState().dispatch(update("old", status));
    assert.equal(store.getState().session.ride, null);
  }
  store.getState().dispatch(update("active", "DRIVER_ASSIGNED"));
  assert.equal(store.getState().session.ride.id, "active");
  store.getState().dispatch(update("active", "COMPLETED", 2));
  assert.equal(store.getState().session.ride.status, "COMPLETED");
});

test("a fast no-driver response for a newly submitted request remains visible", () => {
  accountSession.replace(false);
  const store = loadStore("passenger", {});
  store.getState().dispatch({ type: "ACTION_START", action: "request" });
  store.getState().dispatch({ type: "EVENT", event: { id: "new-outcome", rideId: "new", seq: null, occurredAt: new Date().toISOString(), payload: { type: "ride.updated", ride: { id: "new", status: "NO_DRIVERS", version: 1 } } } });
  assert.equal(store.getState().session.ride.status, "NO_DRIVERS");
});

test("reconnect re-registers DB-online drivers without turning offline drivers on", async () => {
  for (const availability of ["ONLINE", "OFFLINE", "ON_TRIP"]) {
    accountSession.replace(false);
    const writes = [];
    const store = loadStore("driver", {
      getDriverAvailability: async () => availability,
      getCurrentDriverRide: async () => availability === "ON_TRIP" ? { id: "active", status: "IN_PROGRESS", version: 1 } : null,
      setDriverAvailability: async (online) => { writes.push(online); return "ONLINE"; },
    });
    assert.equal(await store.getState().recoverConnection(), true);
    assert.deepEqual(writes, availability === "ONLINE" ? [true] : []);
    assert.equal(store.getState().state.availability, availability);
  }
});

test("recovery never re-registers an assigned driver as available for new rides", async () => {
  accountSession.replace(false);
  let writes = 0;
  const ride = { id: "assigned", status: "DRIVER_ASSIGNED", version: 1 };
  const store = loadStore("driver", {
    getDriverAvailability: async () => "ONLINE",
    getCurrentDriverRide: async () => ride,
    setDriverAvailability: async () => { writes++; return "ONLINE"; },
  });
  await store.getState().recoverConnection();
  assert.equal(writes, 0);
  assert.equal(store.getState().state.ride.ride.id, "assigned");
});

test("manual offline waits for recovery's write and wins", async () => {
  accountSession.replace(false);
  const gate = deferred(), started = deferred(), writes = [];
  const store = loadStore("driver", {
    getDriverAvailability: async () => "ONLINE", getCurrentDriverRide: async () => null,
    setDriverAvailability: async (online) => {
      writes.push(online);
      if (online) { started.resolve(); await gate.promise; }
      return online ? "ONLINE" : "OFFLINE";
    },
  });
  const recovery = store.getState().recoverConnection();
  await started.promise;
  const offline = store.getState().setOnline(false);
  assert.deepEqual(writes, [true]);
  gate.resolve();
  await Promise.all([recovery, offline]);
  assert.deepEqual(writes, [true, false]);
  assert.equal(store.getState().state.availability, "OFFLINE");
});

test("recovery cannot write for a signed-out account", async () => {
  accountSession.replace(false);
  const gate = deferred(); let writes = 0;
  const store = loadStore("driver", {
    getDriverAvailability: () => gate.promise, getCurrentDriverRide: async () => null,
    setDriverAvailability: async () => { writes++; return "ONLINE"; },
  });
  const recovery = store.getState().recoverConnection();
  accountSession.replace(true); gate.resolve("ONLINE");
  assert.equal(await recovery, false);
  assert.equal(writes, 0);
  assert.deepEqual(store.getState().state, driverSession.initialDriverSession);
});

test("accepting a ride waits for an in-flight availability recovery", async () => {
  accountSession.replace(false);
  const started = deferred(), gate = deferred(), calls = [];
  const store = loadStore("driver", {
    getDriverAvailability: async () => "ONLINE", getCurrentDriverRide: async () => null,
    setDriverAvailability: async () => { calls.push("online"); started.resolve(); await gate.promise; return "ONLINE"; },
    acceptOffer: async () => { calls.push("accept"); return { outcome: "accepted", ride: { id: "new", status: "DRIVER_ASSIGNED", version: 1 } }; },
  });
  const recovery = store.getState().recoverConnection(); await started.promise;
  store.getState().dispatch({ type: "OFFER_RECEIVED", offer: { offerId: "offer", rideId: "new" } });
  const acceptance = store.getState().acceptOffer();
  assert.deepEqual(calls, ["online"]);
  gate.resolve(); await Promise.all([recovery, acceptance]);
  assert.deepEqual(calls, ["online", "accept"]);
  assert.equal(store.getState().state.availability, "ON_TRIP");
});

test("failed recovery can retry and an old refresh cannot undo manual offline", async () => {
  accountSession.replace(false);
  let fail = true;
  const gate = deferred();
  let delayed = false;
  const store = loadStore("driver", {
    getDriverAvailability: async () => { if (fail) throw new Error("network"); return delayed ? gate.promise : "ONLINE"; },
    getCurrentDriverRide: async () => null,
    setDriverAvailability: async (online) => online ? "ONLINE" : "OFFLINE",
  });
  assert.equal(await store.getState().recoverConnection(), false);
  fail = false;
  assert.equal(await store.getState().recoverConnection(), true);
  delayed = true;
  const refresh = store.getState().refresh();
  await store.getState().setOnline(false);
  gate.resolve("ONLINE"); await refresh;
  assert.equal(store.getState().state.availability, "OFFLINE");
});
