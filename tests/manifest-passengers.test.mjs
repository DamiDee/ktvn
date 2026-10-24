import test from "node:test";
import assert from "node:assert/strict";
import { loadManifestPassenger, manifestPassengerIds } from "../src/lib/manifest-passengers.ts";

test("manifest name lookups are confined to the selected bus and deduplicate return bookings", () => {
  const bookings = [
    { bus_id: "bus-a", user_id: "ada" },
    { bus_id: "bus-a", user_id: "ada" },
    { bus_id: "bus-a", user_id: "grace" },
    { bus_id: "bus-b", user_id: "other-passenger" },
  ];
  assert.deepEqual(manifestPassengerIds(bookings, "bus-a"), ["ada", "grace"]);
  assert.deepEqual(manifestPassengerIds(bookings, "bus-b"), ["other-passenger"]);
  assert.deepEqual(manifestPassengerIds(bookings, ""), []);
  assert.deepEqual(manifestPassengerIds([], "bus-a"), []);
});

test("name loading uses the existing passenger profile endpoint and retains only the name", async () => {
  const calls = [];
  const controller = new AbortController();
  const passenger = await loadManifestPassenger(async (path, options) => {
    calls.push(path);
    assert.equal(options.signal, controller.signal);
    return { id: "ada", first_name: " Ada ", last_name: "  Okafor ", phone: "private", address: "private", role: "User" };
  }, "ada", controller.signal);
  assert.deepEqual(calls, ["users/ada"]);
  assert.deepEqual(passenger, { id: "ada", name: "Ada Okafor" });
});

test("mismatched, missing or blank names cannot be attached to a passenger's booking", async () => {
  for (const value of [
    { id: "other", first_name: "Wrong", last_name: "Person" },
    { id: "ada" },
    { id: "ada", first_name: " ", last_name: " " },
    null,
  ]) await assert.rejects(loadManifestPassenger(async () => value, "ada"));
});

test("permission errors propagate without retrying or falling back to the global directory", async () => {
  const calls = [];
  const denied = Object.assign(new Error("Forbidden"), { status: 403 });
  await assert.rejects(loadManifestPassenger(async (path) => { calls.push(path); throw denied; }, "ada"), (error) => error === denied);
  assert.deepEqual(calls, ["users/ada"]);
});
