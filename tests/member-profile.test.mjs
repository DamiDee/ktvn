import assert from "node:assert/strict";
import test from "node:test";
import { memberProfileDetails, memberSince } from "../src/lib/member-profile.ts";

test("profile displays API member fields, not demo data or sensitive identity fields", () => {
  const details = memberProfileDetails({ first_name: "Test", last_name: "Member", email: "member@example.com", username: "member", phone: "+2340000000000", address: "Test address", country: "Nigeria", identity_number: "sensitive-placeholder", identity_type: null });
  assert.equal(details.find((field) => field.label === "First name").value, "Test");
  assert.equal(details.find((field) => field.label === "Email").value, "member@example.com");
  assert.equal(details.length, 7);
  assert.equal(JSON.stringify(details).includes("sensitive-placeholder"), false);
});
test("missing profile values have readable fallbacks", () => {
  const details = memberProfileDetails({ first_name: "  ", last_name: null });
  assert.ok(details.every((field) => field.value === "Not provided"));
});
test("member-since handles timezone-free API timestamps and invalid dates", () => {
  assert.equal(memberSince("2026-09-24T14:18:46.717042"), "24 September 2026");
  assert.equal(memberSince("2026-09-24T23:59:59-05:00"), "24 September 2026");
  assert.equal(memberSince(""), "Not available");
  assert.equal(memberSince("invalid"), "Not available");
  assert.equal(memberSince("2026-02-30T14:00:00"), "Not available");
});
