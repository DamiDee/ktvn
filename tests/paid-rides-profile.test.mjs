import assert from "node:assert/strict";
import test from "node:test";
import { loginDestination, liveHome } from "../src/lib/freebus-contract.ts";
import { resolvePaidRidesConnection } from "../src/features/paid-rides/domain/configuration.ts";
import { accountDocumentSource, driverOnlineEligibility, mapAccountViewer } from "../src/features/paid-rides/domain/account-profile.ts";
import { loadAccountViewer } from "../src/features/paid-rides/services/account-service.ts";
import { RideServiceError } from "../src/features/paid-rides/domain/errors.ts";
import { accountSession } from "../src/lib/account-session.ts";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG3sAAAAASUVORK5CYII=";
const wrap = (data) => ({ message: "Retrieved successfully.", data });
function user() {
  return {
    id: "driver-user", first_name: "Test", last_name: "Driver", email: "driver@example.test", username: "testdriver",
    phone: "+2348000000000", address: "Test address", city: "Wuse 2", country: "Nigeria", role: "Driver",
    is_active: true, is_identity_verified: false, identity_type: "NIN", identity_number: "12345678999",
    created_at: "2026-10-17T01:04:48.853846", car: "driver-car",
    driver_profile: {
      id: "driver-profile", user_id: "driver-user", car_id: "driver-car", nin_slip: "JVBERi0xLjcK",
      profile_photo: png, licence_photo: png, is_koinonia_worker: true, koinonia_department: "Ushering department",
      guarantor_name: null, guarantor_phone: null, guarantor_photo: null, guarantor_relationship: null,
      licence_class: "B", licence_number: "TEST12345", licence_expiry_date: "2028-06-17", track: "Both", status: "Pending",
    },
  };
}
function car() {
  return { id: "driver-car", brand: "Toyota", model: "Corolla", color: "Silver", color_hex: null, license_plate: "ABC-123-XY",
    capacity: 7, year: 2018, car_type: "Saloon", car_tier: "Comfort", is_verified: false,
    vehicle_registration: "JVBERi0xLjcK", insurance_certificate: "JVBERi0xLjcK", roadworthiness_certificate: "JVBERi0xLjcK" };
}

test("drivers go straight to paid rides; other role destinations are retained", () => {
  for (const mode of ["api", "mock"]) assert.equal(loginDestination("Driver", mode), "/rides/driver");
  assert.equal(loginDestination("Driver", "off"), "/driver");
  assert.equal(liveHome("Driver"), "/rides/driver");
  assert.equal(loginDestination("User", "api"), "/rides");
  assert.equal(loginDestination("User", "off"), "/passenger/free-buses");
  assert.equal(loginDestination("Admin", "api"), "/admin/free-buses");
  assert.equal(loginDestination("Root", "api"), "/admin/free-buses");
  assert.equal(loginDestination("RouteCoordinator", "api"), "/admin/free-buses/boarding");
});

test("live deployments use the API and matching socket; simulation requires demo or an explicit flag", () => {
  assert.deepEqual(resolvePaidRidesConnection({}), { mode: "api", apiBaseUrl: "https://api.freebus.cloud/api/v1", realtimeUrl: "wss://api.freebus.cloud/rides/ws" });
  assert.equal(resolvePaidRidesConnection({ freeBusesMode: "demo" }).mode, "mock");
  assert.equal(resolvePaidRidesConnection({ freeBusesMode: "live" }).mode, "api");
  assert.equal(resolvePaidRidesConnection({ mode: "off" }).mode, "off");
  assert.equal(resolvePaidRidesConnection({ mode: "mock" }).mode, "mock");
  assert.deepEqual(resolvePaidRidesConnection({ apiBaseUrl: " ", realtimeUrl: " ", freeBusApiBaseUrl: "http://localhost:3009/api/v1/" }), { mode: "api", apiBaseUrl: "http://localhost:3009/api/v1", realtimeUrl: "ws://localhost:3009/rides/ws" });
  assert.equal(resolvePaidRidesConnection({ apiBaseUrl: "https://rides.example.test/v1", realtimeUrl: "wss://socket.example.test/rides" }).realtimeUrl, "wss://socket.example.test/rides");
});

test("driver UserDto populates the real profile, photo, pending status and linked car", () => {
  const viewer = mapAccountViewer(wrap(user()), wrap(car()));
  assert.equal(viewer.displayName, "Test Driver");
  assert.equal(viewer.avatarUrl, `data:image/png;base64,${png}`);
  assert.deepEqual(viewer.roles, ["passenger", "driver"]);
  assert.equal(viewer.account.email, "driver@example.test");
  assert.equal(viewer.account.city, "Wuse 2");
  assert.equal(viewer.account.driver.status, "Pending");
  assert.equal(viewer.account.driver.track, "Both");
  assert.equal(viewer.account.driver.licenceNumber, "TEST12345");
  assert.equal(viewer.account.driver.licenceExpiryDate, "2028-06-17");
  assert.equal(viewer.account.driver.department, "Ushering department");
  assert.equal(viewer.account.maskedNin, "•••••••8999");
  assert.equal(JSON.stringify(viewer).includes("12345678999"), false);
  assert.equal(viewer.vehicle.make, "Toyota");
  assert.equal(viewer.vehicle.plate, "ABC-123-XY");
  assert.equal(viewer.vehicle.capacity, 7);
  assert.equal(viewer.vehicle.year, 2018);
  assert.equal(viewer.vehicle.verified, false);
  assert.equal(viewer.account.documents.length, 6);
  assert.ok(viewer.account.documents.every((doc) => doc.provided && doc.source));
});

test("Base64 photos and PDFs are converted to previews without accepting executable sources", () => {
  assert.equal(accountDocumentSource("/9j/AA=="), "data:image/jpeg;base64,/9j/AA==");
  assert.equal(accountDocumentSource("JVBERi0xLjcK"), "data:application/pdf;base64,JVBERi0xLjcK");
  assert.equal(accountDocumentSource("https://media.example.test/avatar.jpg"), "https://media.example.test/avatar.jpg");
  for (const value of [null, "", "javascript:alert(1)", "data:text/html;base64,PHNjcmlwdD4=", "data:image/svg+xml;base64,PHN2Zz4=", "raw-invalid"])
    assert.equal(accountDocumentSource(value), undefined);
});

test("pending, rejected and unverified vehicles cannot go online, while the driver still sees the workspace", () => {
  const person = user(); const vehicle = car();
  for (const status of ["Pending", "Rejected", "Suspended", "Unknown"]) {
    person.driver_profile.status = status;
    const viewer = mapAccountViewer(person, vehicle);
    assert.ok(viewer.roles.includes("driver"));
    assert.equal(driverOnlineEligibility(viewer).allowed, false);
  }
  person.driver_profile.status = "Approved";
  assert.equal(driverOnlineEligibility(mapAccountViewer(person, vehicle)).allowed, false);
  vehicle.is_verified = true;
  assert.equal(driverOnlineEligibility(mapAccountViewer(person, vehicle)).allowed, true);
  assert.equal(driverOnlineEligibility(mapAccountViewer(person, undefined, true)).allowed, false);
  person.driver_profile = null;
  assert.equal(driverOnlineEligibility(mapAccountViewer(person, vehicle)).allowed, false);
});

test("nullable fields and a passenger account do not inherit a stale driver profile", () => {
  const person = user();
  person.city = null; person.driver_profile.profile_photo = null;
  person.driver_profile.is_koinonia_worker = false; person.driver_profile.guarantor_name = "Test Guarantor";
  const viewer = mapAccountViewer(person);
  assert.equal(viewer.account.city, undefined); assert.equal(viewer.avatarUrl, undefined);
  assert.equal(viewer.account.driver.department, undefined);
  assert.equal(viewer.account.driver.guarantorName, "Test Guarantor");
  person.role = "User";
  const passenger = mapAccountViewer(person, car());
  assert.deepEqual(passenger.roles, ["passenger"]);
  assert.equal(passenger.account.driver, undefined);
  assert.equal(passenger.vehicle, undefined);
  assert.deepEqual(passenger.account.documents, []);
  assert.equal(passenger.account.vehicleId, undefined);
});

test("account loading retrieves the signed-in user and its actual associated car", async () => {
  const calls = []; const signal = new AbortController().signal;
  const viewer = await loadAccountViewer(async (path, options) => {
    calls.push(path); assert.equal(options.signal, signal);
    return path.startsWith("/users/") ? wrap(user()) : wrap(car());
  }, "driver-user", signal);
  assert.deepEqual(calls, ["/users/driver-user", "/cars/driver-car"]);
  assert.equal(viewer.vehicle.model, "Corolla");
  await assert.rejects(loadAccountViewer(async () => wrap(user()), null), { code: "unauthorized" });
  await assert.rejects(loadAccountViewer(async () => wrap(user()), "other-user"), { code: "forbidden" });
});

test("a missing car keeps personal details visible and can be retried; expired sessions propagate", async () => {
  const request = async (path) => {
    if (path.startsWith("/users/")) return wrap(user());
    throw new RideServiceError("not_found");
  };
  const viewer = await loadAccountViewer(request, "driver-user");
  assert.equal(viewer.account.email, "driver@example.test");
  assert.equal(viewer.account.vehicleLoadFailed, true);
  assert.equal(viewer.vehicle, undefined);
  await assert.rejects(loadAccountViewer(async (path) => { if (path.startsWith("/users/")) return user(); throw new RideServiceError("unauthorized"); }, "driver-user"), { code: "unauthorized" });
});

test("late account responses cannot expose a previous login's profile", async () => {
  let resolveUser;
  const response = new Promise((resolve) => { resolveUser = resolve; });
  const pending = loadAccountViewer(async () => response, "driver-user");
  accountSession.replace(false);
  resolveUser(wrap(user()));
  await assert.rejects(pending, { name: "AbortError" });
});

test("deactivated accounts and mismatched driver profiles are rejected", () => {
  assert.throws(() => mapAccountViewer({ ...user(), is_active: false }), { code: "forbidden" });
  const person = user(); person.driver_profile.user_id = "other-user";
  assert.throws(() => mapAccountViewer(person), { code: "unavailable" });
});
