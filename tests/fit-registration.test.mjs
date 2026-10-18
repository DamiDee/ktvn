import assert from "node:assert/strict";
import test from "node:test";
import { fitRegistration } from "../src/features/verification/fit-registration.ts";
import { APPLICATION_TARGET_BYTES } from "../src/lib/document-file.ts";

const size = (payload) => new TextEncoder().encode(JSON.stringify(payload)).length;
const fields = ["nin_slip", "profile_photo", "licence_photo", "vehicle_registration", "insurance_certificate", "roadworthiness_certificate", "vehicle_photo", "guarantor_photo"];
function application(fileBytes) {
  return { first_name: "Driver", last_name: "Member", username: "testdriver", email: "driver@example.test", password: "TestPassword123", phone: "test", address: "Abuja", city: "Abuja", country: "Nigeria", role: "Driver",
    driver_details: { track: "Both", licence_class: "B", nin: "12345678901", vehicle_year: 2020, passenger_seats: 4, ...Object.fromEntries(fields.map((field, i) => [field, Buffer.alloc(fileBytes, i).toString("base64")])) } };
}
const docs = fields.map((field) => ({ field, label: field, mimeType: field.endsWith("photo") ? "image/jpeg" : "application/pdf", originalSizeBytes: 1 }));
const reduced = async (_content, mimeType, targetBytes) => ({ base64: Buffer.alloc(targetBytes - 100).toString("base64"), mimeType, sizeBytes: targetBytes - 100, originalSizeBytes: 1 });

test("an oversized complete application is reduced below the target without dropping details or documents", async () => {
  const payload = application(650_000);
  const original = structuredClone(payload);
  const progress = [];
  const order = [];
  const result = await fitRegistration(payload, docs, async (...args) => { order.push(args[3]); return reduced(...args); }, { onProgress: (event) => progress.push(event) });
  assert.ok(size(payload) > 2 * 1024 * 1024);
  assert.ok(size(result.payload) <= APPLICATION_TARGET_BYTES);
  assert.equal(size(result.payload), result.totalBytes);
  assert.equal(result.originalBytes, size(payload));
  assert.deepEqual(payload, original, "original selections remain untouched until preparation succeeds");
  for (const field of fields) assert.ok(result.payload.driver_details[field]);
  for (const field of ["track", "licence_class", "nin", "vehicle_year", "passenger_seats"]) assert.equal(result.payload.driver_details[field], original.driver_details[field]);
  assert.equal(result.payload.password, original.password);
  assert.equal(result.payload.role, "Driver");
  assert.ok(order.length > 0);
  assert.equal(progress.at(-1).totalBytes, result.totalBytes);
});

test("applications already below the target preserve every original byte", async () => {
  const payload = application(1000);
  const result = await fitRegistration(payload, docs, async () => { throw new Error("unnecessary compression"); });
  assert.deepEqual(result.payload, payload);
  assert.equal(result.prepared.size, 0);
});

test("the largest file is reduced first and a file that cannot be reduced does not prevent trying another", async () => {
  const payload = application(50_000);
  payload.driver_details.nin_slip = Buffer.alloc(900_000).toString("base64");
  payload.driver_details.profile_photo = Buffer.alloc(800_000).toString("base64");
  const order = [];
  const result = await fitRegistration(payload, docs, async (...args) => {
    order.push(args[3]);
    if (args[3] === "nin_slip") throw new Error("Already as small as it can be");
    return reduced(...args);
  });
  assert.equal(order[0], "nin_slip");
  assert.ok(order.includes("profile_photo"));
  assert.ok(result.totalBytes <= APPLICATION_TARGET_BYTES);
  assert.equal(result.payload.driver_details.nin_slip, payload.driver_details.nin_slip);
});

test("an impossible reduction stops locally without truncating files or changing account fields", async () => {
  const payload = application(500_000);
  const original = structuredClone(payload);
  await assert.rejects(fitRegistration(payload, docs, async (base64) => ({ base64, mimeType: "application/pdf", sizeBytes: 1, originalSizeBytes: 1 })), /Contact support/);
  assert.deepEqual(payload, original);
});

test("preparation cancels between reductions and does not return a partial application", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(fitRegistration(application(600_000), docs, async (...args) => { calls++; controller.abort(); return reduced(...args); }, { signal: controller.signal }), (error) => error.name === "AbortError");
  assert.equal(calls, 1);
});

test("the final target includes UTF-8 metadata and Base64 overhead, not just raw file sizes", async () => {
  const payload = application(80_000);
  payload.address = "é".repeat(80_000);
  const result = await fitRegistration(payload, docs, reduced, { targetBytes: 750_000 });
  assert.ok(size(result.payload) <= 750_000);
  assert.equal(result.payload.address, payload.address);
});
