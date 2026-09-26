import test from "node:test";
import assert from "node:assert/strict";
import { createSessionTransport } from "../src/lib/session-transport.ts";

const response = (status) => new Response(JSON.stringify({ status }), { status });
test("concurrent expired requests share one refresh and replay with the same options", async () => {
  let refreshes = 0, expired = 0, renewed = false;
  const calls = [];
  const transport = createSessionTransport(async (path, options) => {
    calls.push([path, options.method, options.body]);
    if (path === "auth/refresh") { refreshes++; await new Promise((r) => setTimeout(r, 10)); renewed = true; return response(200); }
    return response(renewed ? 200 : 401);
  }, () => expired++);
  const results = await Promise.all([transport.request("routes"), transport.request("bookings", { method: "POST", body: '{"trip_id":"Sunday"}' })]);
  assert.deepEqual(results.map((r) => r.status), [200, 200]);
  assert.equal(refreshes, 1); assert.equal(expired, 0);
  assert.deepEqual(calls.filter(([p]) => p === "bookings"), [["bookings", "POST", '{"trip_id":"Sunday"}'], ["bookings", "POST", '{"trip_id":"Sunday"}']]);
});
test("a staggered 401 from an old request uses the newly refreshed session", async () => {
  let release, refreshes = 0, slowCalls = 0;
  const gate = new Promise((r) => { release = r; });
  const transport = createSessionTransport(async (path) => {
    if (path === "auth/refresh") { refreshes++; return response(200); }
    if (path === "slow" && ++slowCalls === 1) { await gate; return response(401); }
    return response(refreshes ? 200 : 401);
  }, () => {});
  const slow = transport.request("slow");
  assert.equal((await transport.request("fast")).status, 200);
  release(); assert.equal((await slow).status, 200); assert.equal(refreshes, 1);
});
test("expired refresh or inactive account invalidates identity; a server failure does not", async () => {
  for (const status of [401, 403, 500]) {
    let expired = 0, calls = 0;
    const transport = createSessionTransport(async (path) => { calls++; return response(path === "auth/refresh" ? status : 401); }, () => expired++);
    assert.equal((await transport.request("routes")).status, status);
    assert.equal(calls, 2); assert.equal(expired, status === 500 ? 0 : 1);
  }
});
test("permission failures and login errors are never refreshed; a replay cannot loop", async () => {
  const paths = [];
  const transport = createSessionTransport(async (path) => { paths.push(path); return response(path === "forbidden" ? 403 : path === "auth/refresh" ? 200 : 401); }, () => {});
  await transport.request("forbidden"); await transport.request("auth/login", { method: "POST" }); await transport.request("users", { method: "POST" });
  assert.deepEqual(paths, ["forbidden", "auth/login", "users"]);
  assert.equal((await transport.request("routes")).status, 401);
  assert.deepEqual(paths.slice(3), ["routes", "auth/refresh", "routes"]);
});
test("network errors never replay a potentially successful mutation or clear identity", async () => {
  let calls = 0, expired = 0;
  const transport = createSessionTransport(async () => { calls++; throw new TypeError("offline"); }, () => expired++);
  await assert.rejects(transport.request("bookings", { method: "POST" }), /offline/);
  assert.equal(calls, 1); assert.equal(expired, 0);
});
test("a cancelled request is not replayed after shared refresh", async () => {
  const controller = new AbortController(); let calls = 0;
  const transport = createSessionTransport(async (path) => { calls++; if (path === "auth/refresh") { controller.abort(); return response(200); } return response(401); }, () => {});
  await assert.rejects(transport.request("routes", { signal: controller.signal }), { name: "AbortError" });
  assert.equal(calls, 2);
  await transport.settleRefresh();
});
