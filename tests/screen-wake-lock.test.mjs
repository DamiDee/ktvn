import test from "node:test";
import assert from "node:assert/strict";
import { maintainScreenWakeLock } from "../src/features/paid-rides/hooks/screen-wake-lock.ts";

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function fixture(requestOverride) {
  const page = new EventTarget();
  page.visibilityState = "visible";
  const host = new EventTarget();
  let tick;
  host.setInterval = (callback) => { tick = callback; return 1; };
  host.clearInterval = () => { tick = null; };
  const locks = [];
  let requests = 0;
  function newLock() {
    const lock = new EventTarget();
    lock.released = false;
    lock.release = async () => { lock.released = true; lock.dispatchEvent(new Event("release")); };
    locks.push(lock);
    return lock;
  }
  const api = { request: () => { requests++; return requestOverride ? requestOverride(newLock) : Promise.resolve(newLock()); } };
  const statuses = [];
  const stop = maintainScreenWakeLock(page, host, api, (status) => statuses.push(status));
  return { page, host, locks, statuses, stop, tick: () => tick?.(), requests: () => requests, hasTimer: () => !!tick };
}

test("holds one lock through focus/gestures and releases when the session ends", async () => {
  const f = fixture();
  await flush();
  assert.equal(f.statuses.at(-1), "active");
  f.host.dispatchEvent(new Event("focus"));
  f.page.dispatchEvent(new Event("pointerdown"));
  f.tick();
  assert.equal(f.requests(), 1);
  f.stop();
  assert.equal(f.locks[0].released, true);
  assert.equal(f.hasTimer(), false);
  f.host.dispatchEvent(new Event("focus"));
  assert.equal(f.requests(), 1);
});

test("releases while hidden and reacquires when visible", async () => {
  const f = fixture();
  await flush();
  f.page.visibilityState = "hidden";
  f.page.dispatchEvent(new Event("visibilitychange"));
  assert.equal(f.locks[0].released, true);
  f.tick();
  assert.equal(f.requests(), 1);
  f.page.visibilityState = "visible";
  f.page.dispatchEvent(new Event("visibilitychange"));
  await flush();
  assert.equal(f.requests(), 2);
  assert.equal(f.statuses.at(-1), "active");
  f.stop();
});

test("OS release reports loss and retries without a tight loop", async () => {
  const f = fixture();
  await flush();
  await f.locks[0].release();
  assert.equal(f.statuses.at(-1), "unavailable");
  assert.equal(f.requests(), 1);
  f.tick();
  await flush();
  assert.equal(f.statuses.at(-1), "active");
  f.stop();
});

test("denial is recoverable on a user gesture", async () => {
  let denied = true;
  const f = fixture((newLock) => denied ? Promise.reject(new Error("Denied")) : Promise.resolve(newLock()));
  await flush();
  assert.equal(f.statuses.at(-1), "unavailable");
  denied = false;
  f.page.dispatchEvent(new Event("pointerdown"));
  await flush();
  assert.equal(f.statuses.at(-1), "active");
  f.stop();
});

test("a request finishing after unmount is released and never reported active", async () => {
  let resolve;
  let makeLock;
  const f = fixture((newLock) => { makeLock = newLock; return new Promise((done) => { resolve = done; }); });
  f.host.dispatchEvent(new Event("focus"));
  assert.equal(f.requests(), 1);
  f.stop();
  const lock = makeLock();
  resolve(lock);
  await flush();
  assert.equal(lock.released, true);
  assert.equal(f.statuses.includes("active"), false);
});

test("unsupported browsers report unavailable without registering timers", () => {
  const statuses = [];
  const stop = maintainScreenWakeLock({}, {}, undefined, (status) => statuses.push(status));
  assert.deepEqual(statuses, ["unavailable"]);
  stop();
});
