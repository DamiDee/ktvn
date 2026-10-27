import test from "node:test";
import assert from "node:assert/strict";
import { passengerSchedulePage, scheduleBelongsToView } from "../src/features/paid-rides/scheduling/passenger-schedules.ts";

test("upcoming and history keep terminal schedules separate without hiding active or unknown states", () => {
  for (const status of ["COMPLETED", "CANCELLED", "EXPIRED"]) {
    assert.equal(scheduleBelongsToView({ status }, "upcoming"), false);
    assert.equal(scheduleBelongsToView({ status }, "history"), true);
  }
  for (const status of ["OPEN", "RESERVED", "ACTIVATED", "FUTURE_STATUS"]) {
    assert.equal(scheduleBelongsToView({ status, scheduledAt: "2020-01-01T00:00:00Z" }, "upcoming"), true);
    assert.equal(scheduleBelongsToView({ status }, "history"), false);
  }
});

test("upcoming trips are found beyond pages containing only old bookings", async () => {
  const calls = [];
  const pages = [
    { items: [{ id: "past", status: "COMPLETED" }], nextCursor: "page-2", total: 3 },
    { items: [{ id: "cancelled", status: "CANCELLED" }, { id: "next", status: "RESERVED" }], nextCursor: "page-3", total: 3 },
  ];
  const page = await passengerSchedulePage(async (query) => { calls.push(query); return pages.shift(); }, "upcoming", { limit: 25 });
  assert.deepEqual(calls, [{ limit: 25 }, { limit: 25, cursor: "page-2" }]);
  assert.deepEqual(page.items, [{ id: "next", status: "RESERVED" }]);
  assert.equal(page.nextCursor, "page-3");
});

test("history skips active-only pages and ends cleanly when no history exists", async () => {
  const pages = [
    { items: [{ status: "OPEN" }], nextCursor: "next", total: 2 },
    { items: [{ status: "ACTIVATED" }], nextCursor: null, total: 2 },
  ];
  const page = await passengerSchedulePage(async () => pages.shift(), "history", {});
  assert.deepEqual(page.items, []);
  assert.equal(page.nextCursor, null);
});

test("pagination propagates failures and cancellation and rejects a repeated cursor", async () => {
  const ctrl = new AbortController(); ctrl.abort();
  await assert.rejects(passengerSchedulePage(async () => { throw new Error("Must not run"); }, "upcoming", {}, ctrl.signal), { name: "AbortError" });
  await assert.rejects(passengerSchedulePage(async () => { throw new Error("Network unavailable"); }, "upcoming", {}), /Network unavailable/);
  await assert.rejects(passengerSchedulePage(async () => ({ items: [], nextCursor: "same", total: 10 }), "upcoming", {}), /could not advance/);
});
