import assert from "node:assert/strict";
import test from "node:test";
import { buildDriverRegistration, DriverApplicationError, documentContentSchema } from "../src/features/verification/driver-registration.ts";
import { DocumentType, DriverTrack } from "../src/types/enums.ts";
import { accountSession } from "../src/lib/account-session.ts";
import { FreebusError, liveAuth } from "../src/services/freebus-api.ts";
import { encodeDocumentFile, MAX_APPLICATION_BYTES, MAX_DOCUMENT_BYTES } from "../src/lib/document-file.ts";
import { mapVehicle } from "../src/features/paid-rides/services/api-mappers.ts";

const credentials = { password: "TestPassword123", confirmPassword: "TestPassword123", acceptedTerms: true };
function application() {
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);
  return {
    identity: {
      fullName: "Test Driver Member", email: "driver@example.com", username: "testdriver",
      phone: "+234 802 000 0000", address: "Test address, Abuja", country: "Nigeria", city: "Abuja",
      nin: "12345678901", workerStatus: "YES", department: "Transportation and Logistics",
      guarantorName: "Stale guarantor", guarantorPhone: "+2348000000000", guarantorRelationship: "Friend",
    },
    licence: { licenceNumber: "ABC12345AA", licenceClass: "B", licenceExpiry: expiry.toISOString().slice(0, 10) },
    vehicle: { make: "Toyota", model: "Corolla", colour: "Silver", plateNumber: "abc-123-xy", year: "2018", seats: "7" },
    tracks: [DriverTrack.PROFESSIONAL],
    documents: Object.fromEntries(Object.values(DocumentType).map((type) => [type, { type, label: type, base64: Buffer.from(`Test file contents: ${type}`).toString("base64"), fileName: `${type}.pdf` }])),
  };
}

test("driver registration maps every field into CreateUserDto.driver_details", () => {
  const draft = application();
  const payload = buildDriverRegistration(draft, credentials);
  assert.deepEqual(payload, {
    first_name: "Test", last_name: "Driver Member", email: "driver@example.com", username: "testdriver",
    phone: "+234 802 000 0000", address: "Test address, Abuja", city: "Abuja", country: "Nigeria",
    password: credentials.password, role: "Driver",
    driver_details: {
      nin: "12345678901", nin_slip: draft.documents[DocumentType.GOVERNMENT_ID].base64,
      profile_photo: draft.documents[DocumentType.PROFILE_PHOTO].base64,
      is_koinonia_worker: true, koinonia_department: "Transportation and Logistics",
      guarantor_name: null, guarantor_phone: null, guarantor_relationship: null, guarantor_photo: null,
      licence_number: "ABC12345AA", licence_class: "B", licence_expiry_date: draft.licence.licenceExpiry,
      licence_photo: draft.documents[DocumentType.DRIVERS_LICENCE].base64,
      vehicle_make: "Toyota", vehicle_model: "Corolla", vehicle_colour: "Silver", vehicle_year: 2018,
      vehicle_plate_number: "ABC-123-XY", passenger_seats: 7,
      vehicle_photo: draft.documents[DocumentType.VEHICLE_PHOTO].base64,
      vehicle_registration: draft.documents[DocumentType.VEHICLE_REGISTRATION].base64,
      insurance_certificate: draft.documents[DocumentType.INSURANCE].base64,
      roadworthiness_certificate: draft.documents[DocumentType.ROADWORTHINESS].base64, track: "Professional",
    },
  });
  assert.equal("confirmPassword" in payload, false);
  assert.equal("acceptedTerms" in payload, false);
  assert.equal("nin" in payload, false);
});

test("tracks map to the backend enum, including Both", () => {
  for (const [tracks, expected] of [
    [[DriverTrack.PROFESSIONAL], "Professional"], [[DriverTrack.VOLUNTEER], "Volunteer"],
    [[DriverTrack.VOLUNTEER, DriverTrack.PROFESSIONAL], "Both"],
    [[DriverTrack.PROFESSIONAL, DriverTrack.VOLUNTEER], "Both"],
  ]) {
    assert.equal(buildDriverRegistration({ ...application(), tracks }, credentials).driver_details.track, expected);
  }
});

test("non-workers send guarantor details and clear stale department", () => {
  const draft = application(); draft.identity.workerStatus = "NO";
  const details = buildDriverRegistration(draft, credentials).driver_details;
  assert.equal(details.is_koinonia_worker, false);
  assert.equal(details.koinonia_department, null);
  assert.equal(details.guarantor_name, "Stale guarantor");
  assert.equal(details.guarantor_phone, "+2348000000000");
  assert.equal(details.guarantor_relationship, "Friend");
  assert.equal(details.guarantor_photo, draft.documents[DocumentType.GUARANTOR_PHOTO].base64);
  delete draft.documents[DocumentType.GUARANTOR_PHOTO];
  assert.throws(() => buildDriverRegistration(draft, credentials), (error) => error instanceof DriverApplicationError && error.stepIndex === 0);
});

test("city and vehicle photo are required", () => {
  const blankCity = application(); blankCity.identity.city = "  ";
  assert.throws(() => buildDriverRegistration(blankCity, credentials), (error) => error instanceof DriverApplicationError && error.stepIndex === 0);
  const noPhoto = application(); delete noPhoto.documents[DocumentType.VEHICLE_PHOTO];
  assert.throws(() => buildDriverRegistration(noPhoto, credentials), (error) => error instanceof DriverApplicationError && error.stepIndex === 2);
});

test("an application larger than the request budget is refused before sending", () => {
  const draft = application();
  // Each document just under the per-file cap; together they exceed the budget.
  const big = Buffer.alloc(MAX_DOCUMENT_BYTES - 1024).toString("base64");
  for (const doc of Object.values(draft.documents)) doc.base64 = big;
  assert.ok(big.length * 7 > MAX_APPLICATION_BYTES);
  assert.throws(() => buildDriverRegistration(draft, credentials), (error) => error instanceof DriverApplicationError && error.stepIndex === 3 && /limit/.test(error.message));
});

test("revalidation rejects incomplete and invalid drafts at the relevant step", () => {
  const invalid = [
    [(d) => { d.identity.username = ""; }, 0],
    [(d) => { d.identity.nin = "bad"; }, 0],
    [(d) => { d.identity.department = "  "; }, 0],
    [(d) => { d.licence.licenceClass = "A"; }, 1],
    [(d) => { d.licence.licenceExpiry = "2099-02-30"; }, 1],
    [(d) => { d.licence.licenceExpiry = "2099-01-01T00:00:00Z"; }, 1],
    [(d) => { d.vehicle.year = "2018.5"; }, 2],
    [(d) => { d.vehicle.seats = "4.5"; }, 2],
    [(d) => { d.vehicle.seats = "0"; }, 2],
    [(d) => { d.vehicle.seats = "2147483648"; }, 2],
    [(d) => { d.vehicle.make = "  "; }, 2],
    [(d) => { delete d.documents[DocumentType.INSURANCE]; }, 3],
    [(d) => { d.documents[DocumentType.GOVERNMENT_ID] = { fileName: "simulated.pdf" }; }, 0],
    [(d) => { d.tracks = []; }, 4],
  ];
  for (const [change, step] of invalid) {
    const draft = application(); change(draft);
    assert.throws(() => buildDriverRegistration(draft, credentials), (error) => error instanceof DriverApplicationError && error.stepIndex === step);
  }
  for (const change of [{ confirmPassword: "DifferentPassword123" }, { acceptedTerms: false }, { password: "weak", confirmPassword: "weak" }]) {
    assert.throws(() => buildDriverRegistration(application(), { ...credentials, ...change }), (error) => error.stepIndex === 5);
  }
});

test("document fields require raw Base64 rather than filenames or local preview URLs", () => {
  for (const value of ["", "blob:example", "data:image/png;base64,example", "https://example.test/document.pdf", "file:///document.pdf", "document.pdf", "YWJj="]) {
    assert.equal(documentContentSchema.safeParse(value).success, false);
  }
});

test("POST /users sends the nested DTO and retains DriverProfileDto in the response, including after logout", async (t) => {
  const payload = buildDriverRegistration(application(), credentials);
  const user = { id: "test-driver-id", role: "Driver", car: "test-car-id", driver_profile: { id: "test-profile-id", profile_photo: payload.driver_details.profile_photo, track: "Both", status: "Pending" } };
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return Response.json(user);
  });
  const wasBlocked = accountSession.isBlocked();
  accountSession.replace(true);
  t.after(() => accountSession.replace(wasBlocked));
  assert.deepEqual(await liveAuth.register(payload), user);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith("/users"));
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.credentials, "include");
  assert.deepEqual(JSON.parse(calls[0].options.body), payload);
  assert.equal(accountSession.isBlocked(), true);
});

test("registration surfaces backend errors without retrying account creation", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({ message: "Username is already taken" }, { status: 400 }); });
  await assert.rejects(liveAuth.register(buildDriverRegistration(application(), credentials)), (error) => error instanceof FreebusError && error.status === 400 && error.message === "Username is already taken");
  assert.equal(calls, 1);
});

test("DriverView vehicle capacity survives mapping and nullable vehicle is supported", () => {
  assert.equal(mapVehicle({ make: "Toyota", model: "Corolla", color: "Silver", plate: "ABC-123-XY", vehicleClass: "sedan", capacity: 7 }).capacity, 7);
  assert.equal(mapVehicle(null), undefined);
});


test("file encoding sends the exact bytes as raw Base64, including across chunks", async () => {
  const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => i % 256);
  const encoded = await encodeDocumentFile(new File([bytes], "nin.pdf", { type: "application/pdf" }));
  assert.equal(encoded.mimeType, "application/pdf");
  assert.equal(encoded.base64.startsWith("data:"), false);
  assert.deepEqual(Buffer.from(encoded.base64, "base64"), Buffer.from(bytes));
  assert.equal(documentContentSchema.safeParse(encoded.base64).success, true);
});

test("file selection rejects empty, oversized and unsupported documents", async () => {
  for (const file of [
    new File([], "empty.pdf", { type: "application/pdf" }),
    new File(["test"], "notes.txt", { type: "text/plain" }),
    new File(["test"], "fake.png", { type: "text/html" }),
    new File([new Uint8Array(MAX_DOCUMENT_BYTES + 1)], "large.pdf", { type: "application/pdf" }),
  ]) {
    await assert.rejects(encodeDocumentFile(file));
  }
  assert.equal((await encodeDocumentFile(new File(["test"], "profile.JPG", { type: "image/jpeg" }))).base64, "dGVzdA==");
});
