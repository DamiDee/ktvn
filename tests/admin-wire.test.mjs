import assert from "node:assert/strict";
import test from "node:test";
import {
  countKey,
  documentTypeToWire,
  latestActiveSos,
  mapAdminRide,
  mapApplication,
  mapDriver,
  mapIncident,
  mapOverview,
  mapPage,
  mapPassenger,
  mapReports,
  mapRideStatus,
  parseAdminFrame,
} from "../src/features/admin/data/admin-wire.ts";

// Synthetic records shaped like the admin API doc (camelCase, { items, nextCursor, total }).

test("pages keep items, cursor, total and normalised chip counts", () => {
  const page = mapPage({ items: [{ id: "a" }, { nope: 1 }], nextCursor: "c1", total: 7, counts: { all: 7, in_progress: 3, underReview: 2 } }, (raw) => (raw.id ? raw : null));
  assert.deepEqual(page.items, [{ id: "a" }]);
  assert.equal(page.nextCursor, "c1");
  assert.equal(page.total, 7);
  assert.equal(page.counts[countKey("inProgress")], 3);
  assert.equal(page.counts[countKey("UNDER_REVIEW")], 2);
});

test("ride statuses go through the paid-rides adapter", () => {
  assert.equal(mapRideStatus("DRIVER_ASSIGNED"), "MATCHED");
  assert.equal(mapRideStatus("DRIVER_EN_ROUTE"), "DRIVER_APPROACHING");
  assert.equal(mapRideStatus("PAUSED"), "IN_PROGRESS");
  assert.equal(mapRideStatus("NO_DRIVERS"), "NO_MATCH");
});

test("network ride maps the single passenger, money-free summary and SOS", () => {
  const ride = mapAdminRide({
    id: "r1", reference: "KR-1", status: "IN_PROGRESS", etaSeconds: 410,
    pickup: { name: "Wuse 2", point: { lat: 9.07, lng: 7.47 } },
    destination: { name: "Koinonia Centre", point: { lat: 9.05, lng: 7.49 } },
    driver: { userId: "d1", displayName: "Ada Driver", rating: 4.9, completedRides: 12, vehicle: { make: "Toyota", model: "Corolla", color: "Silver", plate: "ABC123", capacity: 4 } },
    passengers: [{ userId: "p1", displayName: "Member One", state: "PICKED_UP" }],
    sos: { status: "acknowledged", id: "s1", rideId: "r1", raisedBy: { role: "User", displayName: "Member One" }, raisedAt: "2026-10-19T10:00:00Z" },
    driverLocation: { point: { lat: 9.06, lng: 7.48 }, heading: 90 },
    events: [{ id: "e1", type: "ride.started", at: "2026-10-19T09:50:00Z" }],
  });
  assert.equal(ride.driverId, "d1");
  assert.equal(ride.vehicle.plateNumber, "ABC123");
  assert.equal(ride.passengerCount, 1);
  assert.equal(ride.passengers[0].dropoffLabel, "Koinonia Centre");
  assert.equal(ride.etaMinutes, 7);
  assert.equal(ride.sosActive, true);
  assert.equal(ride.sos.status, "ACKNOWLEDGED");
  assert.equal(ride.sos.raisedBy, "PASSENGER");
  assert.deepEqual(ride.position, { lat: 9.06, lng: 7.48 });
  assert.equal(ride.events[0].label, "Ride started");
  assert.equal(ride.driverPhone, undefined);
});

test("overview orders the four headline cards and shows null metrics as a dash", () => {
  const overview = mapOverview({
    primary: [
      { id: "open_incidents", value: 2 },
      { id: "active_drivers", value: 30, deltaPercent: null },
      { id: "live_rides", value: 4 },
      { id: "pending_verification", value: 5 },
    ],
    secondary: [{ id: "completion_rate", value: 0.964 }, { id: "match_rate", value: null }],
    activeSos: null,
  });
  assert.deepEqual(overview.primary.map((metric) => metric.label), ["Active drivers", "Live rides", "Pending verification", "Open incidents"]);
  assert.equal(overview.secondary[0].display, "96.4%");
  assert.equal(overview.secondary[1].display, "—");
});

test("active SOS picks the newest open alert", () => {
  const sos = latestActiveSos({ items: [
    { id: "old", status: "sent", raisedAt: "2026-10-19T09:00:00Z" },
    { id: "new", status: "responding", raisedAt: "2026-10-19T10:00:00Z" },
    { id: "done", status: "resolved", raisedAt: "2026-10-19T11:00:00Z" },
  ] });
  assert.equal(sos.id, "new");
  assert.equal(latestActiveSos({ items: [] }), null);
});

test("incidents map participants, notes and unknown enums safely", () => {
  const incident = mapIncident({
    id: "i1", reference: "INC-1", category: "SOS_ACTIVATION", severity: "CRITICAL", status: "UNDER_REVIEW", title: "SOS",
    openedAt: "2026-10-19T10:00:00Z", assignedTo: { userId: "a1", displayName: "Desk" },
    participants: [{ userId: "d1", displayName: "Ada", role: "Driver", phone: "+234 800" }],
    notes: [{ id: "n1", author: { displayName: "Desk" }, note: "Called", createdAt: "2026-10-19T10:05:00Z" }],
  });
  assert.equal(incident.assignedTo, "Desk");
  assert.equal(incident.participants[0].role, "DRIVER");
  assert.equal(incident.participants[0].phone, "+234 800");
  assert.equal(incident.adminNotes[0].author, "Desk");
  assert.equal(mapIncident({ id: "i2", category: "WEIRD", severity: "?", status: "?" }).category, "OTHER");
});

test("applications map document types both ways and derive steps", () => {
  const application = mapApplication({
    userId: "u1", applicantName: "Ada", track: "Both", status: "INSPECTION_SCHEDULED",
    documents: [
      { type: "ROADWORTHINESS_CERTIFICATE", status: "VERIFIED" },
      { type: "DRIVERS_LICENCE", status: "NEEDS_ATTENTION", note: "Blurry" },
    ],
    inspection: { status: "SCHEDULED", scheduledAt: "2026-10-25T09:00:00Z", location: "Bay 1" },
    comments: [{ id: "c1", body: "Looks good", visibility: "APPLICANT", documentType: "ROADWORTHINESS_CERTIFICATE" }],
  });
  assert.equal(application.track, "PROFESSIONAL");
  assert.deepEqual(application.tracks, ["VOLUNTEER", "PROFESSIONAL"]);
  assert.equal(application.documents[0].id, "ROADWORTHINESS");
  assert.equal(application.comments[0].documentId, "ROADWORTHINESS");
  assert.equal(documentTypeToWire("ROADWORTHINESS"), "ROADWORTHINESS_CERTIFICATE");
  assert.equal(application.inspection.scheduled, true);
  assert.equal(application.steps.find((step) => step.id === "inspection").status, "ACTIVE");
  assert.equal(mapApplication({ userId: "u2", status: "pending" }).status, "DOCUMENT_REVIEW");
  assert.equal(mapApplication({ userId: "u3", documentsReady: 3, documentsTotal: 7 }).documentsTotal, 7);
});

test("drivers and passengers map roster fields without phones", () => {
  const driver = mapDriver({ userId: "d1", displayName: "Ada", track: "Professional", availability: "ON_TRIP", accountStatus: "FLAGGED", verificationStatus: "APPROVED", rating: null, completedRides: 4, stats: { weekRides: 2, weekEarnings: { amountMinor: 1250000, currency: "NGN" } } });
  assert.equal(driver.availability, "ON_TRIP");
  assert.equal(driver.flagged, true);
  assert.equal(driver.earningsSummary.weekToDate, 12500);
  assert.equal(mapDriver({ userId: "d2", active: false, availability: "ONLINE" }).availability, "OFFLINE");

  const passenger = mapPassenger({ userId: "p1", displayName: "Member", membershipStatus: "CHECKING", trustedContactCount: 2, restricted: true, trustedContacts: [{ id: "t1", name: "Kin", relationship: "Sister", phone: "+234" }] });
  assert.equal(passenger.trustedContactCount, 2);
  assert.equal(passenger.trustedContacts[0].phone, "");
  assert.equal(passenger.restricted, true);
});

test("reports read sections with daily series", () => {
  const [section] = mapReports([{ id: "safety", metrics: [{ id: "avg_resolution_minutes", value: 42.4 }], series: [{ date: "2026-10-01", value: 2 }] }]);
  assert.equal(section.title, "Safety");
  assert.equal(section.metrics[0].display, "42 min");
  assert.equal(section.series[0].label, "1 Oct");
});

test("socket frames become refetch hints", () => {
  const frame = (type, extra = {}) => JSON.stringify({ type: "event", event: { id: "e", rideId: "r1", payload: { type, ...extra } } });
  assert.deepEqual(parseAdminFrame(frame("admin.ride.changed")), { kind: "ride", rideId: "r1" });
  assert.deepEqual(parseAdminFrame(frame("sos.raised")), { kind: "sos", rideId: "r1" });
  assert.deepEqual(parseAdminFrame(frame("incident.updated", { incidentId: "i1" })), { kind: "incident", incidentId: "i1", rideId: "r1" });
  assert.deepEqual(parseAdminFrame(frame("admin.resync_required")), { kind: "resync" });
  assert.equal(parseAdminFrame(frame("ride.driver.location_updated")), null);
  assert.equal(parseAdminFrame('{"type":"pong"}'), null);
  assert.equal(parseAdminFrame("not json"), null);
});
