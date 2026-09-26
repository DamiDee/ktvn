import assert from "node:assert/strict";
import test from "node:test";
import { canAdminister, canBook, canBoard, liveHome, queryString, availableCapacity, activeBooking } from "../src/lib/freebus-contract.ts";
import { liveLoginSchema, liveSignUpSchema } from "../src/features/auth/schemas.ts";

test("query parameters preserve false, encode values and omit empty filters", () => {
  assert.equal(queryString({ is_completed: false, search: "Lugbe Police", empty: "", missing: undefined }), "?is_completed=false&search=Lugbe+Police");
});
test("only members book and only oversight administers", () => {
  assert.equal(canBook("User"), true);
  assert.equal(canAdminister("User"), false);
  for (const role of ["Admin", "Root"]) {
    assert.equal(canAdminister(role), true);
    assert.equal(canBook(role), false);
  }
  // A Driver or RouteCoordinator is neither, and is never silently promoted to either.
  for (const role of ["Driver", "RouteCoordinator", "", "Unexpected"]) {
    assert.equal(canBook(role), false);
    assert.equal(canAdminister(role), false);
  }
});
test("full is not the same as departed; unavailable buses cannot offer seats", () => {
  const bus = { state: "Boarding", status: "Available", capacity: 18, current_passenger_count: 17 };
  assert.equal(availableCapacity(bus), 1);
  assert.equal(availableCapacity({ ...bus, current_passenger_count: 18 }), 0);
  for (const state of ["Transit", "Arrived"]) assert.equal(availableCapacity({ ...bus, state }), 0);
  assert.equal(availableCapacity({ ...bus, status: "Maintenance" }), 0);
});
test("only active bookings occupy a member's ticket list", () => {
  assert.equal(activeBooking({ status: "Confirmed" }), true);
  assert.equal(activeBooking({ status: "Boarded" }), true);
  assert.equal(activeBooking({ status: "Cancelled" }), false);
  assert.equal(activeBooking({ status: "Revoked" }), false);
});
test("coordinators land at boarding but have no oversight or member booking access", () => {
  assert.equal(canBoard("RouteCoordinator"), true);
  assert.equal(canAdminister("RouteCoordinator"), false);
  assert.equal(canBook("RouteCoordinator"), false);
  assert.equal(liveHome("RouteCoordinator"), "/admin/free-buses/boarding");
  assert.equal(canBoard("User"), false);
  assert.equal(canBoard("Driver"), false);
});
test("live login accepts usernames; registration needs API fields, not NIN", () => {
  assert.equal(liveLoginSchema.safeParse({ identifier: "member_username", password: "Test12345" }).success, true);
  const form = { fullName: "Test Member", email: "test@example.com", phone: "+2340000000000", password: "Test12345", confirmPassword: "Test12345", acceptedTerms: true, username: "testmember", address: "Test address", country: "Nigeria", city: "Lugbe" };
  assert.equal(liveSignUpSchema.safeParse(form).success, true);
  assert.equal(liveSignUpSchema.safeParse({ ...form, address: "" }).success, false);
});
