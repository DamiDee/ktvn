import { PAID_RIDES_MODE } from "@/features/paid-rides/config";
import { adminService, rideService, userService, verificationService } from "@/services";
import { createId } from "@/services/api-client";
import {
  DocumentStatus,
  DriverAccountStatus,
  DriverAvailability,
  DriverTrack,
  IncidentSeverity,
  IncidentStatus,
  MembershipStatus,
  RideStatus,
  RideType,
  VerificationStatus,
  type DocumentStatus as DocumentStatusValue,
} from "@/types/enums";
import type {
  AdminMetric,
  Driver,
  DriverVerification,
  Incident,
  LiveRideSummary,
  Passenger,
  PhysicalInspection,
  QualityFlag,
  ReportSection,
  ReviewComment,
  SOSAlert,
  VerificationDocument,
} from "@/types/models";
import { adminDownload, adminRequest, withQuery } from "./admin-api";
import {
  AVAILABILITY_FILTER_ONLINE,
  RIDE_STATUS_FILTER,
  countKey,
  documentTypeToWire,
  latestActiveSos,
  mapAdminRide,
  mapApplication,
  mapApplicationDocument,
  mapComment0,
  mapDriver,
  mapIncident,
  mapLiveDrivers,
  mapOverview,
  mapPage,
  mapPassenger,
  mapQualityFlag,
  mapReports,
  mapRideRow,
  mapSos,
  type AdminPage,
  type AdminRideRow,
  type LiveDriversSnapshot,
} from "./admin-wire";

/**
 * The one data source for the Paid Rides admin screens.
 *
 * `NEXT_PUBLIC_PAID_RIDES` decides it, like the rest of Paid Rides: `api`
 * talks to `/api/v1/admin/*` (live deployments default to it), `mock` keeps
 * the demo records so the workspace can still be shown without a backend.
 * Screens never check the mode; they call `adminData`.
 *
 * Lists are fetched with server-side filters and search, up to 100 rows (the
 * API's maximum page). A filter the API can't express in one request — "in
 * review" spans three application states — is answered by merging one
 * request per state.
 */

export const ADMIN_LIVE = PAID_RIDES_MODE === "api";

const PAGE_LIMIT = 100;

export type Period = "WEEK" | "MONTH" | "QUARTER";
export type RideFilter = "ALL" | "SOS" | "PROFESSIONAL" | "SHARED" | "PRIVATE" | "MATCHING" | "IN_PROGRESS";
export type IncidentFilter = "ALL" | "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CRITICAL";
export type ApplicationFilter = "ALL" | "REVIEW" | "INSPECTION" | "CHANGES" | "PROFESSIONAL";
export type DriverFilter = "ALL" | "PROFESSIONAL" | "ONLINE" | "PENDING" | "FLAGGED" | "DEACTIVATED";
export type PassengerFilter = "ALL" | "VERIFIED" | "PENDING" | "NO_CONTACTS";
export type Decision = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

export interface ListQuery<F> {
  filter: F;
  q?: string;
}

export interface AdminOverviewData {
  primary: AdminMetric[];
  secondary: AdminMetric[];
  activeSos: SOSAlert | null;
}

export interface Appointment {
  scheduledAt: string;
  location: string;
  note?: string;
}

export interface CallResult {
  phone?: string;
  callHref?: string;
}

export type { AdminPage, AdminRideRow, LiveDriversSnapshot };
export type { LiveDriver, LiveDriverRideStatus } from "./admin-wire";

export interface AdminData {
  getOverview(period?: Period): Promise<AdminOverviewData>;
  getActiveSos(): Promise<SOSAlert | null>;
  acknowledgeSos(id: string): Promise<SOSAlert | null>;
  resolveSos(id: string, note?: string): Promise<SOSAlert | null>;

  listRides(query: ListQuery<RideFilter>): Promise<AdminPage<LiveRideSummary>>;
  getRide(id: string): Promise<LiveRideSummary | null>;
  listPastRides(status: "COMPLETED" | "CANCELLED", cursor: string | null, q?: string): Promise<AdminPage<LiveRideSummary>>;

  listIncidents(query: ListQuery<IncidentFilter>): Promise<AdminPage<Incident>>;
  getIncident(id: string): Promise<Incident | null>;
  updateIncidentStatus(id: string, status: IncidentStatus): Promise<Incident | null>;
  addIncidentNote(id: string, note: string): Promise<Incident["adminNotes"][number]>;
  callParticipant(incidentId: string, participantId: string): Promise<CallResult>;

  listApplications(query: ListQuery<ApplicationFilter>): Promise<AdminPage<DriverVerification>>;
  getApplication(id: string): Promise<DriverVerification | null>;
  setDocumentStatus(id: string, documentId: string, status: DocumentStatusValue, note?: string): Promise<VerificationDocument>;
  addReviewComment(id: string, comment: { body: string; visibility: ReviewComment["visibility"]; documentId?: string }): Promise<ReviewComment>;
  scheduleApplicationInspection(id: string, appointment: Appointment): Promise<PhysicalInspection>;
  decide(id: string, decision: Decision, detail?: { reason?: string; changesRequested?: string[] }): Promise<VerificationStatus>;

  /** Every online driver's last ping. Not paginated; drivers drop off ~15 s after their last ping. */
  listLiveDrivers(): Promise<LiveDriversSnapshot>;
  listDrivers(query: ListQuery<DriverFilter>): Promise<AdminPage<Driver>>;
  getDriver(id: string): Promise<Driver | null>;
  listDriverRides(id: string): Promise<AdminRideRow[]>;
  flagDriver(id: string, reason: string): Promise<void>;
  clearDriverFlag(id: string): Promise<void>;
  deactivateDriver(id: string, reason: string): Promise<void>;
  activateDriver(id: string): Promise<void>;
  scheduleDriverInspection(id: string, appointment: Appointment): Promise<void>;

  listPassengers(query: ListQuery<PassengerFilter>): Promise<AdminPage<Passenger>>;
  getPassenger(id: string): Promise<Passenger | null>;
  listPassengerRides(id: string): Promise<AdminRideRow[]>;
  restrictPassenger(id: string, reason: string): Promise<void>;
  liftRestriction(id: string): Promise<void>;
  requestMembershipCheck(id: string): Promise<void>;

  listQualityFlags(): Promise<QualityFlag[]>;
  clearQualityFlag(id: string, note?: string): Promise<void>;

  listReports(period: Period): Promise<ReportSection[]>;
  exportReports(period: Period): Promise<"downloaded" | "queued">;
}

const id = encodeURIComponent;
const periodParam = (period: Period) => period.toLowerCase();

/** Several single-value requests merged into one list, newest first. */
async function merged<T extends { id: string }>(requests: Promise<AdminPage<T>>[], sortKey: (item: T) => string): Promise<AdminPage<T>> {
  const pages = await Promise.all(requests);
  const seen = new Map<string, T>();
  for (const page of pages) for (const item of page.items) seen.set(item.id, item);
  const items = [...seen.values()].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  return {
    items,
    nextCursor: pages.some((page) => page.nextCursor) ? "more" : null,
    total: pages.reduce((sum, page) => sum + page.total, 0),
    counts: pages[0]?.counts ?? {},
  };
}

// ─── Live ─────────────────────────────────────────────────────────────────────

const live: AdminData = {
  async getOverview(period = "WEEK") {
    return mapOverview(await adminRequest(withQuery("admin/overview", { period: periodParam(period) })));
  },
  async getActiveSos() {
    return latestActiveSos(await adminRequest(withQuery("admin/sos", { status: "active" })));
  },
  async acknowledgeSos(alertId) {
    return mapSos(await adminRequest(`admin/sos/${id(alertId)}/acknowledge`, { method: "POST" }));
  },
  async resolveSos(alertId, note) {
    return mapSos(await adminRequest(`admin/sos/${id(alertId)}/resolve`, { method: "POST", body: note ? { note } : {} }));
  },

  async listRides({ filter, q }) {
    // There is no pooled matching yet: every ride is private, none shared.
    if (filter === "SHARED") return { items: [], nextCursor: null, total: 0, counts: {} };
    const status = filter === "MATCHING" ? RIDE_STATUS_FILTER.MATCHING : filter === "IN_PROGRESS" ? RIDE_STATUS_FILTER.IN_PROGRESS : undefined;
    return mapPage(await adminRequest(withQuery("admin/rides", {
      state: "active", status, sos: filter === "SOS" ? true : undefined, q: q?.trim(), limit: PAGE_LIMIT,
    })), mapAdminRide);
  },
  async listPastRides(status, cursor, q) {
    return mapPage(await adminRequest(withQuery("admin/rides", {
      state: "all", status, cursor, q: q?.trim(), limit: PAGE_LIMIT,
    })), mapAdminRide);
  },
  async getRide(rideId) {
    return mapAdminRide(await adminRequest(`admin/rides/${id(rideId)}`));
  },

  async listIncidents({ filter, q }) {
    const page = (query: Record<string, string | undefined>) =>
      adminRequest(withQuery("admin/incidents", { ...query, q: q?.trim(), limit: PAGE_LIMIT })).then((body) => mapPage(body, mapIncident));
    if (filter === "CRITICAL") {
      return merged([page({ severity: IncidentSeverity.CRITICAL }), page({ severity: IncidentSeverity.HIGH })], (item) => item.openedAt);
    }
    return page({ status: filter === "ALL" ? undefined : filter });
  },
  async getIncident(incidentId) {
    return mapIncident(await adminRequest(`admin/incidents/${id(incidentId)}`));
  },
  async updateIncidentStatus(incidentId, status) {
    return mapIncident(await adminRequest(`admin/incidents/${id(incidentId)}`, { method: "PATCH", body: { status } }));
  },
  async addIncidentNote(incidentId, note) {
    const body = await adminRequest<Record<string, unknown> | null>(`admin/incidents/${id(incidentId)}/notes`, { method: "POST", body: { note } });
    const mapped = mapIncident({ id: incidentId, adminNotes: [body && "data" in body ? body.data : body] });
    return mapped?.adminNotes[0] ?? { id: createId("note"), author: "You", note, at: new Date().toISOString() };
  },
  async callParticipant(incidentId, participantId) {
    const body = await adminRequest<{ phone?: unknown; callHref?: unknown } | null>(`admin/incidents/${id(incidentId)}/calls`, { method: "POST", body: { participantId } });
    return {
      phone: typeof body?.phone === "string" ? body.phone : undefined,
      callHref: typeof body?.callHref === "string" ? body.callHref : undefined,
    };
  },

  async listApplications({ filter, q }) {
    const page = (status?: VerificationStatus) =>
      adminRequest(withQuery("admin/driver-applications", { status, q: q?.trim(), limit: PAGE_LIMIT })).then((body) => mapPage(body, mapApplication));
    const groups: Partial<Record<ApplicationFilter, VerificationStatus[]>> = {
      REVIEW: [VerificationStatus.SUBMITTED, VerificationStatus.DOCUMENT_REVIEW, VerificationStatus.FINAL_REVIEW],
      INSPECTION: [VerificationStatus.INSPECTION_REQUIRED, VerificationStatus.INSPECTION_SCHEDULED],
      CHANGES: [VerificationStatus.CHANGES_REQUIRED],
    };
    const statuses = groups[filter];
    const result = statuses ? await merged(statuses.map(page), (item) => item.submittedAt ?? item.updatedAt) : await page();
    // "Both" applicants belong here; volunteer-only ones don't.
    const items = result.items.filter((item) => item.track === DriverTrack.PROFESSIONAL);
    return { ...result, items };
  },
  async getApplication(userId) {
    return mapApplication(await adminRequest(`admin/driver-applications/${id(userId)}`));
  },
  async setDocumentStatus(userId, documentId, status, note) {
    const body = await adminRequest(`admin/driver-applications/${id(userId)}/documents/${id(documentTypeToWire(documentId))}`, {
      method: "PATCH", body: { status, note: note || undefined },
    });
    const document = mapApplicationDocument(body, documentTypeToWire(documentId));
    if (!document) throw new Error("Unexpected document response");
    return { ...document, status: document.status === DocumentStatus.MISSING ? status : document.status, note: note ?? document.note };
  },
  async addReviewComment(userId, comment) {
    const body = await adminRequest(`admin/driver-applications/${id(userId)}/comments`, {
      method: "POST",
      body: { body: comment.body, visibility: comment.visibility, documentType: comment.documentId ? documentTypeToWire(comment.documentId) : undefined },
    });
    return mapComment0(body) ?? { id: createId("vc"), author: "You", body: comment.body, at: new Date().toISOString(), visibility: comment.visibility, documentId: comment.documentId };
  },
  async scheduleApplicationInspection(userId, appointment) {
    const body = await adminRequest(`admin/driver-applications/${id(userId)}/inspection`, { method: "POST", body: appointment });
    const mapped = mapApplication({ id: userId, inspection: body && typeof body === "object" && "data" in body ? (body as { data: unknown }).data : body });
    return { ...(mapped?.inspection ?? { required: true }), required: true, scheduled: true, ...appointment };
  },
  async decide(userId, decision, detail = {}) {
    const body = await adminRequest<{ status?: unknown } | null>(`admin/driver-applications/${id(userId)}/decision`, {
      method: "POST",
      body: { decision, reason: detail.reason || undefined, changesRequested: detail.changesRequested?.length ? detail.changesRequested : undefined },
    });
    const fallback = decision === "APPROVE" ? VerificationStatus.APPROVED : decision === "REJECT" ? VerificationStatus.REJECTED : VerificationStatus.CHANGES_REQUIRED;
    return mapApplication({ id: userId, status: body?.status ?? fallback })?.status ?? fallback;
  },

  async listLiveDrivers() {
    return mapLiveDrivers(await adminRequest("admin/drivers/live"));
  },
  async listDrivers({ filter, q }) {
    const page = mapPage(await adminRequest(withQuery("admin/drivers", {
      q: q?.trim(),
      availability: filter === "ONLINE" ? AVAILABILITY_FILTER_ONLINE : undefined,
      flagged: filter === "FLAGGED" ? true : undefined,
      active: filter === "DEACTIVATED" ? false : undefined,
      limit: PAGE_LIMIT,
    })), mapDriver);
    let items = page.items.filter((driver) => driver.track === DriverTrack.PROFESSIONAL);
    // "Not yet approved" spans every non-approved state; narrowed here.
    if (filter === "PENDING") items = items.filter((driver) => driver.verificationStatus !== VerificationStatus.APPROVED);
    return { ...page, items };
  },
  async getDriver(driverId) {
    return mapDriver(await adminRequest(`admin/drivers/${id(driverId)}`));
  },
  async listDriverRides(driverId) {
    return mapPage(await adminRequest(withQuery(`admin/drivers/${id(driverId)}/rides`, { limit: 10 })), mapRideRow).items;
  },
  async flagDriver(driverId, reason) {
    await adminRequest(`admin/drivers/${id(driverId)}/flag`, { method: "POST", body: { reason } });
  },
  async clearDriverFlag(driverId) {
    await adminRequest(`admin/drivers/${id(driverId)}/flag`, { method: "DELETE" });
  },
  async deactivateDriver(driverId, reason) {
    await adminRequest(`admin/drivers/${id(driverId)}/deactivate`, { method: "POST", body: { reason } });
  },
  async activateDriver(driverId) {
    await adminRequest(`users/${id(driverId)}/activate`, { method: "PATCH" });
  },
  async scheduleDriverInspection(driverId, appointment) {
    await adminRequest(`admin/drivers/${id(driverId)}/inspection`, { method: "POST", body: appointment });
  },

  async listPassengers({ filter, q }) {
    const page = mapPage(await adminRequest(withQuery("admin/passengers", {
      q: q?.trim(),
      membership: filter === "VERIFIED" ? MembershipStatus.VERIFIED : undefined,
      hasTrustedContact: filter === "NO_CONTACTS" ? false : undefined,
      limit: PAGE_LIMIT,
    })), mapPassenger);
    const items = filter === "PENDING" ? page.items.filter((passenger) => passenger.membershipStatus !== MembershipStatus.VERIFIED) : page.items;
    return { ...page, items };
  },
  async getPassenger(passengerId) {
    return mapPassenger(await adminRequest(`admin/passengers/${id(passengerId)}`));
  },
  async listPassengerRides(passengerId) {
    return mapPage(await adminRequest(withQuery(`admin/passengers/${id(passengerId)}/rides`, { limit: 10 })), mapRideRow).items;
  },
  async restrictPassenger(passengerId, reason) {
    await adminRequest(`admin/passengers/${id(passengerId)}/restriction`, { method: "POST", body: { reason } });
  },
  async liftRestriction(passengerId) {
    await adminRequest(`admin/passengers/${id(passengerId)}/restriction`, { method: "DELETE" });
  },
  async requestMembershipCheck(passengerId) {
    await adminRequest(`admin/passengers/${id(passengerId)}/membership-check`, { method: "POST" });
  },

  async listQualityFlags() {
    const [drivers, members] = await Promise.all(["Driver", "User"].map((role) =>
      adminRequest(withQuery("admin/quality-flags", { role, status: "open", limit: PAGE_LIMIT })).then((body) => mapPage(body, mapQualityFlag).items)));
    return [...drivers.filter((flag) => flag.track !== DriverTrack.VOLUNTEER), ...members]
      .sort((a, b) => b.flaggedAt.localeCompare(a.flaggedAt));
  },
  async clearQualityFlag(flagId, note) {
    await adminRequest(`admin/quality-flags/${id(flagId)}/clear`, { method: "POST", body: note ? { note } : {} });
  },

  async listReports(period) {
    return mapReports(await adminRequest(withQuery("admin/reports", { period: periodParam(period) })));
  },
  async exportReports(period) {
    await adminDownload(withQuery("admin/reports/export", { period: periodParam(period) }), `paid-rides-report-${periodParam(period)}.csv`);
    return "downloaded";
  },
};

// ─── Demo ─────────────────────────────────────────────────────────────────────

function page<T>(items: T[], counts: Record<string, number> = {}): AdminPage<T> {
  return { items, nextCursor: null, total: items.length, counts };
}

function matches(term: string | undefined, ...fields: (string | undefined)[]): boolean {
  const needle = term?.trim().toLowerCase();
  return !needle || fields.some((field) => field?.toLowerCase().includes(needle));
}

function rideRow(ride: { id: string; reference: string; destination: { label: string }; rideType: RideType; requestedAt: string; fare?: number; status: RideStatus; track: DriverTrack }): AdminRideRow {
  return { id: ride.id, reference: ride.reference, destinationLabel: ride.destination.label, rideType: ride.rideType, requestedAt: ride.requestedAt, fare: ride.fare, status: ride.status, track: ride.track };
}

const demo: AdminData = {
  async getOverview() {
    const overview = await adminService.getOverview();
    return { primary: overview.primary, secondary: overview.secondary, activeSos: overview.activeSos };
  },
  async getActiveSos() {
    return (await adminService.getOverview()).activeSos;
  },
  async acknowledgeSos() {
    return adminService.acknowledgeSos();
  },
  async resolveSos() {
    return null;
  },

  async listRides({ filter, q }) {
    const all = (await adminService.listLiveRides()).filter((ride) => ride.track === DriverTrack.PROFESSIONAL);
    const items = all.filter((ride) => {
      switch (filter) {
        case "SOS": return ride.sosActive;
        case "SHARED": return ride.rideType === RideType.SHARED;
        case "PRIVATE": return ride.rideType === RideType.PRIVATE;
        case "MATCHING": return ride.status === RideStatus.SEARCHING;
        case "IN_PROGRESS": return ride.status === RideStatus.IN_PROGRESS;
        default: return true;
      }
    }).filter((ride) => matches(q, ride.driverName, ride.reference, ride.destinationLabel, ...ride.passengers.map((person) => person.name)));
    return page(items, { all: all.length, sos: all.filter((ride) => ride.sosActive).length });
  },
  async listPastRides(status, _cursor, q) {
    const rides = (await adminService.listLiveRides()).filter((ride) =>
      ride.track === DriverTrack.PROFESSIONAL && ride.status === status && matches(q, ride.driverName, ride.reference, ride.destinationLabel));
    return page(rides, {});
  },
  async getRide(rideId) {
    return adminService.getLiveRide(rideId);
  },

  async listIncidents({ filter, q }) {
    const all = await adminService.listIncidents();
    const items = all.filter((incident) => {
      if (filter === "CRITICAL") return incident.severity === IncidentSeverity.CRITICAL || incident.severity === IncidentSeverity.HIGH;
      return filter === "ALL" || incident.status === filter;
    }).filter((incident) => matches(q, incident.title, incident.reference));
    return page(items, { all: all.length });
  },
  async getIncident(incidentId) {
    return adminService.getIncident(incidentId);
  },
  async updateIncidentStatus(incidentId, status) {
    const incident = await adminService.getIncident(incidentId);
    return incident ? { ...incident, status, resolvedAt: status === IncidentStatus.RESOLVED ? new Date().toISOString() : undefined } : null;
  },
  async addIncidentNote(_incidentId, note) {
    return { id: createId("note"), author: "You", note, at: new Date().toISOString() };
  },
  async callParticipant() {
    return {};
  },

  async listApplications({ filter, q }) {
    const all = (await verificationService.listQueue()).filter((item) => item.track === DriverTrack.PROFESSIONAL);
    const items = all.filter((record) => {
      switch (filter) {
        case "REVIEW": return record.status === VerificationStatus.DOCUMENT_REVIEW || record.status === VerificationStatus.SUBMITTED || record.status === VerificationStatus.FINAL_REVIEW;
        case "INSPECTION": return record.status === VerificationStatus.INSPECTION_REQUIRED || record.status === VerificationStatus.INSPECTION_SCHEDULED;
        case "CHANGES": return record.status === VerificationStatus.CHANGES_REQUIRED;
        default: return true;
      }
    }).filter((record) => matches(q, record.applicantName));
    return page(items, { all: all.length });
  },
  async getApplication(applicationId) {
    return verificationService.getVerification(applicationId);
  },
  async setDocumentStatus(applicationId, documentId, status, note) {
    return verificationService.setDocumentStatus(applicationId, documentId, status, note);
  },
  async addReviewComment(applicationId, comment) {
    return verificationService.addComment(applicationId, comment);
  },
  async scheduleApplicationInspection(applicationId, appointment) {
    return verificationService.scheduleInspection(applicationId, appointment);
  },
  async decide(applicationId, decision) {
    return verificationService.decide(applicationId, decision);
  },

  async listLiveDrivers() {
    return adminService.listLiveDrivers();
  },
  async listDrivers({ filter, q }) {
    const all = (await userService.listDrivers()).filter((driver) => driver.track === DriverTrack.PROFESSIONAL);
    const items = all.filter((driver) => {
      switch (filter) {
        case "ONLINE": return driver.availability !== DriverAvailability.OFFLINE;
        case "PENDING": return driver.verificationStatus !== VerificationStatus.APPROVED;
        case "FLAGGED": return Boolean(driver.flagged);
        case "DEACTIVATED": return driver.accountStatus === DriverAccountStatus.DEACTIVATED;
        default: return true;
      }
    }).filter((driver) => matches(q, driver.fullName, driver.vehicle.plateNumber));
    return page(items, {
      all: all.length,
      flagged: all.filter((driver) => driver.flagged).length,
      deactivated: all.filter((driver) => driver.accountStatus === DriverAccountStatus.DEACTIVATED).length,
    });
  },
  async getDriver(driverId) {
    return userService.getDriver(driverId);
  },
  async listDriverRides() {
    return (await rideService.listDriverTrips(DriverTrack.PROFESSIONAL)).map(rideRow);
  },
  async flagDriver(driverId) {
    await userService.updateDriverAccountStatus(driverId, DriverAccountStatus.FLAGGED);
  },
  async clearDriverFlag(driverId) {
    await userService.updateDriverAccountStatus(driverId, DriverAccountStatus.ACTIVE);
  },
  async deactivateDriver(driverId, reason) {
    await userService.updateDriverAccountStatus(driverId, DriverAccountStatus.DEACTIVATED, reason);
  },
  async activateDriver(driverId) {
    await userService.updateDriverAccountStatus(driverId, DriverAccountStatus.ACTIVE);
  },
  async scheduleDriverInspection(driverId, appointment) {
    await userService.scheduleDriverInspection(driverId, appointment);
  },

  async listPassengers({ filter, q }) {
    const all = await userService.listPassengers();
    const items = all.filter((passenger) => {
      switch (filter) {
        case "VERIFIED": return passenger.membershipStatus === MembershipStatus.VERIFIED;
        case "PENDING": return passenger.membershipStatus !== MembershipStatus.VERIFIED;
        case "NO_CONTACTS": return passenger.trustedContacts.length === 0;
        default: return true;
      }
    }).filter((passenger) => matches(q, passenger.fullName, passenger.email));
    return page(items, { all: all.length });
  },
  async getPassenger(passengerId) {
    return userService.getPassenger(passengerId);
  },
  async listPassengerRides() {
    return (await rideService.listRides()).filter((ride) => ride.track === DriverTrack.PROFESSIONAL).map(rideRow);
  },
  async restrictPassenger() {},
  async liftRestriction() {},
  async requestMembershipCheck() {},

  async listQualityFlags() {
    return adminService.listQualityFlags();
  },
  async clearQualityFlag() {},

  async listReports() {
    return adminService.listReports();
  },
  async exportReports() {
    return "queued";
  },
};

export const adminData: AdminData = ADMIN_LIVE ? live : demo;

/** Count for a filter chip, from the server's counts or the loaded rows. */
export function chipCount(counts: Record<string, number>, key: string): number | undefined {
  return counts[countKey(key)];
}
