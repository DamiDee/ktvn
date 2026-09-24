import assert from "node:assert/strict";
import test from "node:test";
import { signUpSchema } from "../src/features/auth/schemas.ts";

const registration = {
  fullName: "Test Member",
  email: "member@example.com",
  phone: "+234 802 000 0000",
  password: "TestPassword123",
  confirmPassword: "TestPassword123",
  acceptedTerms: true,
};

test("registration succeeds without a NIN", () => {
  assert.deepEqual(signUpSchema.parse(registration), registration);
});

test("registration does not retain a legacy NIN field", () => {
  assert.deepEqual(signUpSchema.parse({ ...registration, nin: "12345678901" }), registration);
});

test("registration still validates contact details and terms", () => {
  for (const change of [
    { fullName: "Test" },
    { email: "invalid" },
    { phone: "" },
    { acceptedTerms: false },
  ]) {
    assert.equal(signUpSchema.safeParse({ ...registration, ...change }).success, false);
  }
});

test("registration still requires a strong, matching password", () => {
  assert.equal(signUpSchema.safeParse({
    ...registration, password: "weak", confirmPassword: "weak",
  }).success, false);
  const result = signUpSchema.safeParse({ ...registration, confirmPassword: "DifferentPassword123" });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((issue) => issue.path.includes("confirmPassword")));
});
