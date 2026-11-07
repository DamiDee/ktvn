import assert from "node:assert/strict";
import test from "node:test";
import { normalizePhone, phoneInputValue, PHONE_COUNTRIES } from "../src/lib/phone.ts";
import { displayPhone } from "../src/lib/account-display.ts";
import { signUpSchema } from "../src/features/auth/schemas.ts";

test("country selection produces international phone numbers without duplicate codes", () => {
  for (const [input, country, expected] of [
    ["0802 000 0000", "NG", "+2348020000000"],
    ["+234 802 000 0000", "NG", "+2348020000000"],
    ["00234 802 000 0000", "NG", "+2348020000000"],
    ["07700 900123", "GB", "+447700900123"],
    ["(202) 555-0123", "US", "+12025550123"],
    ["024 123 4567", "GH", "+233241234567"],
    ["06 6982", "IT", "+39066982"],
    ["+44 7700 900123", "NG", "+447700900123"],
  ]) assert.equal(normalizePhone(input, country), expected, input);
});

test("empty, incomplete, overlong and non-phone input is rejected", () => {
  for (const input of ["", "   ", "123", "+2341234567890123456", "call 08020000000", "+2348020000000 ext 1"]) {
    assert.equal(normalizePhone(input), undefined, input);
  }
  assert.equal(phoneInputValue("", "GB"), "");
  assert.equal(phoneInputValue("12", "GB"), "+4412");
  assert.equal(normalizePhone(phoneInputValue("12", "GB")), undefined);
});

test("registration retains the normalized code displayed by System Users", () => {
  for (const [input, country, code] of [["08020000000", "NG", "+234"], ["07700900123", "GB", "+44"]]) {
    const phone = phoneInputValue(input, country);
    const result = signUpSchema.parse({ fullName: "Test Member", email: "test@example.com", phone, city: "Abuja", password: "TestPassword123", confirmPassword: "TestPassword123", acceptedTerms: true });
    assert.equal(result.phone, phone);
    assert.ok(displayPhone(result.phone).startsWith(code));
  }
  assert.ok(PHONE_COUNTRIES.some(({ value, label }) => value === "NG" && label.includes("+234")));
  assert.ok(PHONE_COUNTRIES.some(({ value, label }) => value === "GB" && label.includes("+44")));
});
