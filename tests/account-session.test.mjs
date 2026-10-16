import test from "node:test";
import assert from "node:assert/strict";
import { AccountSession, accountResult, accountSession, combineSignals } from "../src/lib/account-session.ts";
import { getSessionClient, withSessionLock } from "../src/services/session-client.ts";

const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

test("account boundaries abort pending work and reject late results, including same-account re-login", async () => {
  const session = new AccountSession(); const old = session.capture(); const task = deferred();
  const result = accountResult(old, task.promise);
  session.replace(true); session.replace(false);
  assert.equal(old.signal.aborted, true);
  task.resolve({ privateRide: "account A" });
  await assert.rejects(result, { name: "AbortError" });
  assert.equal(session.capture().isCurrent(), true);
});

test("cross-tab revision fences results before the storage event is delivered", () => {
  let stamp = "A"; const session = new AccountSession(() => stamp); const old = session.capture();
  stamp = "B";
  assert.equal(old.isCurrent(), false);
  assert.throws(() => old.assertCurrent(), { name: "AbortError" });
});

test("merged cancellation preserves both account and caller signals", () => {
  const a = new AbortController(), b = new AbortController();
  const merged = combineSignals([a.signal, b.signal]); b.abort();
  assert.equal(merged.signal.aborted, true); merged.dispose();
  assert.equal(combineSignals([a.signal, b.signal]).signal.aborted, true);
});

test("Free Buses and Paid Rides share one refresh and preserve mutation replay", async (t) => {
  accountSession.replace(false);
  const original = globalThis.fetch; const gate = deferred(); let renewed = false, refreshes = 0;
  const mutations = [];
  globalThis.fetch = async (url, init) => {
    if (url.endsWith("auth/refresh")) { refreshes++; await gate.promise; renewed = true; return new Response("{}"); }
    if (url.endsWith("rides/request")) mutations.push([init.body, init.headers["Idempotency-Key"]]);
    return new Response("{}", { status: renewed ? 200 : 401 });
  };
  t.after(() => { globalThis.fetch = original; accountSession.replace(false); });
  const buses = getSessionClient("https://shared.test/api/v1/");
  const rides = getSessionClient("https://shared.test/api/v1");
  assert.equal(buses, rides);
  const results = Promise.all([buses.request("bookings"), rides.request("rides/request", { method: "POST", body: '{"estimateId":"q"}', headers: { "Idempotency-Key": "attempt-one" } })]);
  await new Promise((resolve) => setImmediate(resolve)); gate.resolve();
  assert.deepEqual((await results).map((r) => r.status), [200, 200]);
  assert.equal(refreshes, 1);
  assert.deepEqual(mutations, [['{"estimateId":"q"}', "attempt-one"], ['{"estimateId":"q"}', "attempt-one"]]);
});

test("logout waits for an in-flight cookie refresh, but the old request never replays", async (t) => {
  accountSession.replace(false);
  const original = globalThis.fetch; const gate = deferred(); let started = false; const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url.endsWith("auth/refresh")) { started = true; await gate.promise; return new Response("{}"); }
    return new Response("{}", { status: url.endsWith("auth/logout") ? 200 : 401 });
  };
  t.after(() => { globalThis.fetch = original; accountSession.replace(false); });
  const base = "https://logout.test/api/v1", client = getSessionClient(base);
  const pending = assert.rejects(client.request("rides/current"), { name: "AbortError" });
  await new Promise((resolve) => setImmediate(resolve)); assert.equal(started, true);
  accountSession.replace(true);
  const logout = withSessionLock(base, () => client.request("auth/logout", { method: "POST" }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.some((url) => url.endsWith("auth/logout")), false);
  gate.resolve(); await pending; assert.equal((await logout).status, 200);
  assert.equal(calls.filter((url) => url.endsWith("rides/current")).length, 1);
});

test("a late successful response from account A cannot be returned to account B", async (t) => {
  accountSession.replace(false);
  const original = globalThis.fetch, gate = deferred();
  globalThis.fetch = () => gate.promise; // deliberately ignores abort to test the generation fence
  t.after(() => { globalThis.fetch = original; accountSession.replace(false); });
  const result = assert.rejects(getSessionClient("https://late.test").request("rides/current"), { name: "AbortError" });
  accountSession.replace(false); gate.resolve(new Response('{"ride":"A"}')); await result;
});
