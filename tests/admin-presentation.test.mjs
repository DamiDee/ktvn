import test from "node:test";
import assert from "node:assert/strict";
import { displayName, displayPhone } from "../src/lib/account-display.ts";
import { isPastAdminTrip } from "../src/lib/trips.ts";

test("system user names use consistent capitalization without losing punctuation", () => {
  assert.equal(displayName("  Daniel   AJAYI "), "Daniel Ajayi");
  assert.equal(displayName("abigarl daneil"), "Abigarl Daneil");
  assert.equal(displayName("ANNE-MARIE O’NEILL"), "Anne-Marie O’Neill");
});

test("Nigerian mobile formats normalize without damaging unfamiliar numbers", () => {
  for (const phone of ["08012345678", "+234 801 234 5678", "2348012345678", "002348012345678", "8012345678"])
    assert.equal(displayPhone(phone), "+234 801 234 5678");
  assert.equal(displayPhone("+44 20 7946 0123"), "+44 20 7946 0123");
  assert.equal(displayPhone("123"), "123");
  assert.equal(displayPhone(null), "—");
});

test("admin trip history respects WAT days, statuses and pending returns", () => {
  const now = Date.parse("2030-01-06T23:30:00Z"); // January 7 in Abuja
  const trip = { status: "NotStarted", departure_time: "2030-01-06T22:00:00Z" };
  assert.equal(isPastAdminTrip(trip, now), true);
  assert.equal(isPastAdminTrip({ ...trip, departure_time: "2030-01-06T23:05:00Z" }, now), false);
  assert.equal(isPastAdminTrip({ ...trip, status: "InProgress" }, now), false);
  assert.equal(isPastAdminTrip({ ...trip, return_time: "2030-01-07T17:00:00Z" }, now), false);
  for (const status of ["Cancelled", "Completed"])
    assert.equal(isPastAdminTrip({ ...trip, status, departure_time: "2030-01-08T09:00:00Z" }, now), true);
  assert.equal(isPastAdminTrip({ ...trip, departure_time: "invalid" }, now), false);
});
