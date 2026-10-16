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

// Execute the actual stores with injected network adapters, without browser or live API writes.
function loadStore(name, service) {
  const file = new URL(`../src/features/paid-rides/state/${name}-store.ts`, import.meta.url);
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const dependencies = {
    zustand: { create }, "@/lib/account-session": { accountSession, accountResult },
    "../domain/errors": errors, "../domain/phases": phases, "../domain/ride-session": rideSession,
    "../domain/driver-session": driverSession, "../analytics": { trackRideEvent() {} },
    "../services": { getRideService: () => service, newIdempotencyKey: () => crypto.randomUUID() },
    "./dismissed-rides": { withoutDismissed: (ride) => ride, dismissRideLocally() {} },
    "./preferences-store": { rememberRecentPlace() {} },
  };
  const module = new Module(file.pathname);
  module.require = (specifier) => { if (!(specifier in dependencies)) throw new Error(`Unexpected dependency: ${specifier}`); return dependencies[specifier]; };
  module._compile(compiled, file.pathname);
  return module.exports[name === "passenger" ? "usePassengerStore" : "useDriverStore"];
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
