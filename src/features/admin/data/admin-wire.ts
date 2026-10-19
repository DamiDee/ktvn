import {
  DocumentStatus,
  DocumentType,
  DriverAccountStatus,
  DriverAvailability,
  DriverTrack,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  InspectionStatus,
  MembershipStatus,
  RidePassengerState,
  RideStatus,
  RideType,
  SOSStatus,
  UserRole,
  VerificationStatus,
} from "../../../types/enums.ts";
import type {
  AdminMetric,
  Coordinates,
  Driver,
  DriverVerification,
  Incident,
  LiveRidePassenger,
  LiveRideSummary,
  Passenger,
  QualityFlag,
  ReportSection,
  ReviewComment,
  RideEvent,
  SOSAlert,
  Vehicle,
  VerificationDocument,
  VerificationStep,
} from "../../../types/models.ts";
import { accountDocumentSource } from "../../paid-rides/domain/account-profile.ts";

/**
 * Wire → view-model mapping for the Paid Rides admin API (`/api/v1/admin/*`).
 * Contract: docs/paid-rides/openapi.json (`Page_*`, `AdminRideSummary`,
 * `PersonSummary`, `ApplicationSummary`, `Application`, `ApplicationDocument`,
 * `Incident`, `SosAlert`, `Overview`, `Metric`, `ReportSection`) and
 * docs/paid-rides/PAID_RIDES_ADMIN.md for the rules.
 *
 * The admin screens were built against the view models in `types/models.ts`;
 * these functions translate the backend's camelCase JSON into them so the
 * screens don't change shape between demo and live data. Several nested
 * objects (`driver`, `passengers[]`, `sos`, `inspection`, `affiliation`,
 * `participants[]`, `timeline[]`, `adminNotes[]`, `comments[]`) and the
 * detail bodies of `/admin/rides/{id}`, `/admin/drivers/{id}`,
 * `/admin/passengers/{id}` and `/admin/quality-flags` are untyped in the
 * spec, so those are read defensively: a missing value degrades the screen,
 * it never crashes it.
 *
 * Pure and dependency-free so `tests/admin-wire.test.mjs` can run it in Node.
 */

type Json = Record<string, unknown>;

export function obj(value: unknown): Json | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function bool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function upper(value: unknown): string {
  return (str(value) ?? "").toUpperCase().replace(/[\s-]+/g, "_");
}

/** `{ message, data }` envelopes are unwrapped; bare bodies pass through. */
export function unwrap(value: unknown): unknown {
  const raw = obj(value);
  return raw && "data" in raw && "message" in raw ? raw.data : value;
}

// ─── Pages ────────────────────────────────────────────────────────────────────

export interface AdminPage<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
  /** Chip counts, keyed as the server sends them (`all`, `sos`, `open`, …). */
  counts: Record<string, number>;
}

export function mapPage<T>(value: unknown, item: (raw: unknown) => T | null): AdminPage<T> {
  const body = unwrap(value);
  const raw = obj(body);
  const source = Array.isArray(body) ? body : list(raw?.items);
  const items = source.map(item).filter((entry): entry is T => entry !== null);
  const counts: Record<string, number> = {};
  for (const [key, count] of Object.entries(obj(raw?.counts) ?? {})) {
    const value = num(count);
    if (value !== undefined) counts[countKey(key)] = value;
  }
  return {
    items,
    nextCursor: str(raw?.nextCursor) ?? null,
    total: num(raw?.total) ?? items.length,
    counts,
  };
}

/** `in_progress`, `inProgress` and `IN_PROGRESS` all become `inprogress`. */
export function countKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ─── Shared pieces ────────────────────────────────────────────────────────────

/** Minor units → whole naira, the unit every admin screen formats. */
export function mapAmount(value: unknown): number | undefined {
  const money = obj(value);
  if (money) {
    const minor = num(money.amountMinor);
    return minor === undefined ? undefined : minor / 100;
  }
  return undefined;
}

function mapPoint(value: unknown): Coordinates | null {
  const raw = obj(value);
  const lat = num(raw?.lat);
  const lng = num(raw?.lng);
  return lat === undefined || lng === undefined ? null : { lat, lng };
}

function placeName(value: unknown): string {
  const raw = obj(value);
  return str(raw?.name) ?? str(raw?.label) ?? str(value) ?? "Unknown place";
}

export function mapVehicle(value: unknown): Vehicle {
  const raw = obj(value) ?? {};
  const plate = str(raw.plate) ?? str(raw.license_plate) ?? str(raw.plateNumber) ?? "";
  return {
    id: str(raw.id) ?? plate,
    make: str(raw.make) ?? str(raw.brand) ?? "",
    model: str(raw.model) ?? "",
    colour: str(raw.color) ?? str(raw.colour) ?? "",
    plateNumber: plate,
    year: num(raw.year),
    seats: num(raw.capacity) ?? num(raw.seats) ?? 0,
    verified: bool(raw.verified) ?? bool(raw.isVerified) ?? bool(raw.is_verified) ?? false,
  };
}

/** Backend `Volunteer | Professional | Both` → the admin's track list. */
export function mapTracks(value: unknown): DriverTrack[] {
  const track = upper(value);
  if (track === "BOTH") return [DriverTrack.VOLUNTEER, DriverTrack.PROFESSIONAL];
  if (track === "VOLUNTEER") return [DriverTrack.VOLUNTEER];
  return [DriverTrack.PROFESSIONAL];
}

/** The workspace shows professional records; `Both` drivers belong here too. */
export function mapTrack(value: unknown): DriverTrack {
  return mapTracks(value).includes(DriverTrack.PROFESSIONAL) ? DriverTrack.PROFESSIONAL : DriverTrack.VOLUNTEER;
}

export function trackToWire(track: DriverTrack): string {
  return track === DriverTrack.VOLUNTEER ? "Volunteer" : "Professional";
}

function mapRole(value: unknown): UserRole {
  const role = upper(value);
  if (role === "DRIVER") return UserRole.DRIVER;
  if (role === "ADMIN" || role === "ROOT" || role === "ROUTECOORDINATOR") return UserRole.ADMIN;
  return UserRole.PASSENGER;
}

function person(value: unknown): { id: string; name: string; avatarUrl?: string } {
  const raw = obj(value) ?? {};
  return {
    id: str(raw.userId) ?? str(raw.id) ?? "",
    name: str(raw.displayName) ?? str(raw.name) ?? "Unknown",
    avatarUrl: str(raw.avatarUrl) ?? undefined,
  };
}

function personName(value: unknown): string | undefined {
  return str(value) ?? (obj(value) ? person(value).name : undefined);
}

// ─── Ride status adapter ──────────────────────────────────────────────────────

/**
 * Paid-rides wire statuses (see `paid-rides/domain/ride-status.ts`) mapped
 * onto the admin's presentation statuses. Paused trips read as in progress;
 * both approach states read as "approaching".
 */
const RIDE_STATUS: Record<string, RideStatus> = {
  REQUESTED: RideStatus.REQUESTING,
  SEARCHING: RideStatus.SEARCHING,
  NO_DRIVERS: RideStatus.NO_MATCH,
  DRIVER_ASSIGNED: RideStatus.MATCHED,
  DRIVER_EN_ROUTE: RideStatus.DRIVER_APPROACHING,
  DRIVER_ARRIVING: RideStatus.DRIVER_APPROACHING,
  DRIVER_ARRIVED: RideStatus.DRIVER_ARRIVED,
  IN_PROGRESS: RideStatus.IN_PROGRESS,
  PAUSED: RideStatus.IN_PROGRESS,
  COMPLETED: RideStatus.COMPLETED,
  CANCELLED: RideStatus.CANCELLED,
};

export function mapRideStatus(value: unknown): RideStatus {
  return RIDE_STATUS[upper(value)] ?? RideStatus.SEARCHING;
}

/** Live-rides filter chips → the `status` query value the server expects. */
export const RIDE_STATUS_FILTER = {
  MATCHING: "SEARCHING",
  IN_PROGRESS: "IN_PROGRESS",
} as const;

// ─── Safety ───────────────────────────────────────────────────────────────────

const SOS_STATUS: Record<string, SOSStatus> = {
  SENT: SOSStatus.SENT,
  ACKNOWLEDGED: SOSStatus.ACKNOWLEDGED,
  RESPONDING: SOSStatus.RESPONDING,
  RESOLVED: SOSStatus.RESOLVED,
  NONE: SOSStatus.INACTIVE,
};

export function mapSosStatus(value: unknown): SOSStatus {
  return SOS_STATUS[upper(value)] ?? SOSStatus.SENT;
}

export function isSosOpen(value: unknown): boolean {
  const status = upper(value);
  return status === "SENT" || status === "ACKNOWLEDGED" || status === "RESPONDING";
}

export function mapSos(value: unknown): SOSAlert | null {
  const raw = obj(unwrap(value));
  const id = str(raw?.id);
  if (!raw || !id) return null;
  const raisedBy = obj(raw.raisedBy);
  return {
    id,
    rideId: str(raw.rideId) ?? "",
    rideReference: str(raw.rideReference) ?? str(raw.rideId)?.slice(0, 8) ?? "",
    status: mapSosStatus(raw.status),
    raisedBy: mapRole(raisedBy?.role ?? raw.raisedByRole) === UserRole.DRIVER ? "DRIVER" : "PASSENGER",
    raisedByName: (raisedBy ? person(raisedBy).name : undefined) ?? str(raw.raisedByName) ?? "A rider",
    raisedAt: str(raw.raisedAt) ?? str(raw.createdAt) ?? new Date(0).toISOString(),
    acknowledgedAt: str(raw.acknowledgedAt),
    respondingAt: str(raw.respondingAt),
    resolvedAt: str(raw.resolvedAt),
    location: mapPoint(raw.location) ?? undefined,
    note: str(raw.note) ?? str(raw.type),
  };
}

/** `GET /admin/sos?status=active` → the most recent open alert, if any. */
export function latestActiveSos(value: unknown): SOSAlert | null {
  const alerts = mapPage(value, mapSos).items.filter((alert) => alert.status !== SOSStatus.RESOLVED && alert.status !== SOSStatus.INACTIVE);
  alerts.sort((a, b) => Date.parse(b.raisedAt) - Date.parse(a.raisedAt));
  return alerts[0] ?? null;
}

function mapEventKind(value: unknown, type: string): RideEvent["kind"] {
  const kind = str(value)?.toLowerCase();
  if (kind === "status" || kind === "safety" || kind === "payment" || kind === "rating") return kind;
  if (/sos|safety|incident/.test(type)) return "safety";
  if (/pay|fare/.test(type)) return "payment";
  if (/rat/.test(type)) return "rating";
  return "status";
}

function humanise(value: string): string {
  const words = value.replace(/[._]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : value;
}

export function mapEvent(value: unknown, index: number): RideEvent | null {
  const raw = obj(value);
  if (!raw) return null;
  const type = str(raw.type) ?? str(raw.event) ?? "";
  const at = str(raw.at) ?? str(raw.occurredAt) ?? str(raw.createdAt);
  if (!at) return null;
  return {
    id: str(raw.id) ?? `event-${index}`,
    label: str(raw.label) ?? (type ? humanise(type) : "Update"),
    detail: str(raw.detail) ?? str(raw.description) ?? str(raw.note),
    at,
    kind: mapEventKind(raw.kind, type),
  };
}

const INCIDENT_STATUS = new Set<string>(Object.values(IncidentStatus));
const INCIDENT_SEVERITY = new Set<string>(Object.values(IncidentSeverity));
const INCIDENT_CATEGORY = new Set<string>(Object.values(IncidentCategory));

export function mapIncident(value: unknown): Incident | null {
  const raw = obj(unwrap(value));
  const id = str(raw?.id);
  if (!raw || !id) return null;
  const status = upper(raw.status);
  const severity = upper(raw.severity);
  const category = upper(raw.category);
  const notes = list(raw.adminNotes ?? raw.notes);
  return {
    id,
    reference: str(raw.reference) ?? id.slice(0, 8).toUpperCase(),
    rideId: str(raw.rideId),
    rideReference: str(raw.rideReference),
    category: (INCIDENT_CATEGORY.has(category) ? category : IncidentCategory.OTHER) as Incident["category"],
    severity: (INCIDENT_SEVERITY.has(severity) ? severity : IncidentSeverity.MEDIUM) as Incident["severity"],
    status: (INCIDENT_STATUS.has(status) ? status : IncidentStatus.OPEN) as Incident["status"],
    title: str(raw.title) ?? "Untitled incident",
    description: str(raw.description) ?? "",
    openedAt: str(raw.openedAt) ?? str(raw.createdAt) ?? new Date(0).toISOString(),
    updatedAt: str(raw.updatedAt) ?? str(raw.openedAt) ?? new Date(0).toISOString(),
    resolvedAt: str(raw.resolvedAt),
    assignedTo: personName(raw.assignedTo),
    participants: list(raw.participants).map((entry) => {
      const item = obj(entry) ?? {};
      const who = person(item);
      return { id: who.id, name: who.name, role: mapRole(item.role), phone: str(item.phone) };
    }),
    timeline: list(raw.timeline).map(mapEvent).filter((event): event is RideEvent => event !== null),
    adminNotes: notes.flatMap((entry, index) => {
      const note = obj(entry);
      const text = str(note?.note) ?? str(note?.body);
      if (!note || !text) return [];
      return [{
        id: str(note.id) ?? `note-${index}`,
        author: personName(note.author) ?? "Oversight team",
        note: text,
        at: str(note.at) ?? str(note.createdAt) ?? new Date(0).toISOString(),
      }];
    }),
  };
}

// ─── Network rides ────────────────────────────────────────────────────────────

const PASSENGER_STATE = new Set<string>(Object.values(RidePassengerState));

function mapRidePassenger(value: unknown, index: number): LiveRidePassenger | null {
  const raw = obj(value);
  if (!raw) return null;
  const who = person(raw);
  const state = upper(raw.state);
  return {
    id: who.id || `passenger-${index}`,
    name: who.name,
    avatarUrl: who.avatarUrl,
    verified: bool(raw.verified) ?? true,
    rating: num(raw.rating) ?? 0,
    dropoffLabel: placeName(raw.dropoff ?? raw.destination),
    state: (PASSENGER_STATE.has(state) ? state : RidePassengerState.AWAITING_PICKUP) as RidePassengerState,
    phone: str(raw.phone),
  };
}

export function mapAdminRide(value: unknown): LiveRideSummary | null {
  const raw = obj(unwrap(value));
  const id = str(raw?.id);
  if (!raw || !id) return null;
  const driver = obj(raw.driver);
  const sos = obj(raw.sos);
  const timestamps = obj(raw.timestamps);
  const location = obj(raw.driverLocation);
  const pickup = obj(raw.pickup);
  const destination = raw.destination;
  const passengers = list(raw.passengers ?? (raw.passenger ? [raw.passenger] : []))
    .map((entry, index) => mapRidePassenger(entry, index))
    .filter((entry): entry is LiveRidePassenger => entry !== null)
    .map((entry) => (entry.dropoffLabel === "Unknown place" ? { ...entry, dropoffLabel: placeName(destination) } : entry));
  const etaSeconds = num(raw.etaSeconds) ?? num(obj(raw.approach)?.etaSeconds) ?? num(obj(raw.progress)?.remainingSeconds);
  const sosAlert = sos && str(sos.id) ? mapSos(sos) : null;
  const sosStatus = sos?.status ?? raw.sosStatus;
  const events = list(raw.events).map(mapEvent).filter((event): event is RideEvent => event !== null);
  return {
    id,
    reference: str(raw.reference) ?? id.slice(0, 8).toUpperCase(),
    driverId: driver ? person(driver).id : "",
    driverName: driver ? person(driver).name : "Awaiting driver",
    driverAvatarUrl: driver ? person(driver).avatarUrl : undefined,
    driverRating: num(driver?.rating) ?? 0,
    driverTrips: num(driver?.completedRides) ?? 0,
    driverPhone: str(driver?.phone),
    vehicle: mapVehicle(driver?.vehicle ?? raw.vehicle),
    track: str(raw.track) ? mapTrack(raw.track) : DriverTrack.PROFESSIONAL,
    rideType: upper(raw.rideType) === RideType.SHARED ? RideType.SHARED : RideType.PRIVATE,
    originLabel: placeName(raw.pickup),
    destinationLabel: placeName(destination),
    passengerCount: passengers.length,
    passengers,
    status: mapRideStatus(raw.status),
    startedAt: str(raw.startedAt) ?? str(timestamps?.startedAt),
    etaMinutes: etaSeconds !== undefined ? Math.max(0, Math.round(etaSeconds / 60)) : 0,
    sosActive: isSosOpen(sosAlert?.status ?? sosStatus),
    position: mapPoint(location?.point) ?? mapPoint(pickup?.point) ?? { lat: 0, lng: 0 },
    heading: num(location?.heading) ?? 0,
    events: events.length > 0 ? events : undefined,
    sos: sosAlert ?? undefined,
  };
}

// ─── Metrics and reports ──────────────────────────────────────────────────────

/** Labels for ids the admin doc and screens agree on; others are humanised. */
const METRIC_LABEL: Record<string, string> = {
  activedrivers: "Active drivers",
  liverides: "Live rides",
  pendingverification: "Pending verification",
  pendingverifications: "Pending verification",
  openincidents: "Open incidents",
  completionrate: "Completion rate",
  matchrate: "Match rate",
  avgrating: "Average rating",
  averagerating: "Average rating",
  ridesthisweek: "Rides this week",
  ridesrequested: "Rides requested",
  ridescompleted: "Rides completed",
  activepassengers: "Active passengers",
  approvalrate: "Approval rate",
  avgverificationdays: "Avg. verification time",
  cancellationrate: "Cancellations",
  incidents: "Incidents",
  sosalerts: "SOS alerts",
  avgresolutionminutes: "Avg. resolution",
  passengerrating: "Passenger rating",
  driverrating: "Driver rating",
  repeatpassengerrate: "Repeat passengers",
};

/** Dashboard card order; the screen assigns icons by position. */
const PRIMARY_ORDER = ["activedrivers", "liverides", "pendingverification", "pendingverifications", "openincidents"];

function formatMetric(key: string, value: number): string {
  if (/rate$/.test(key)) {
    // Rates may arrive as fractions or percentages; a fraction is never above 1.
    const percent = value <= 1 ? value * 100 : value;
    return `${percent.toFixed(1)}%`;
  }
  if (/days$/.test(key)) return `${value.toFixed(1)} days`;
  if (/minutes$/.test(key)) return `${Math.round(value)} min`;
  if (/rating$/.test(key)) return value.toFixed(2);
  return Math.round(value).toLocaleString("en-NG");
}

export function mapMetric(value: unknown): AdminMetric | null {
  const raw = obj(value);
  const id = str(raw?.id) ?? str(raw?.key);
  if (!raw || !id) return null;
  const key = countKey(id);
  const metric = num(raw.value);
  const series = list(raw.series).map((point) => num(point) ?? num(obj(point)?.value)).filter((point): point is number => point !== undefined);
  const delta = num(raw.deltaPercent);
  return {
    id,
    label: str(raw.label) ?? METRIC_LABEL[key] ?? humanise(id),
    // Null means "not measurable" (doc: never fabricated); show a dash.
    value: metric ?? 0,
    display: metric === undefined ? "—" : str(raw.display) ?? formatMetric(key, metric),
    deltaPercent: delta,
    intent: delta === undefined ? "neutral" : delta >= 0 ? "positive" : "attention",
    series: series.length > 1 ? series : undefined,
  };
}

function metricList(value: unknown): AdminMetric[] {
  return list(value).map(mapMetric).filter((metric): metric is AdminMetric => metric !== null);
}

export interface AdminOverviewWire {
  primary: AdminMetric[];
  secondary: AdminMetric[];
  activeSos: SOSAlert | null;
}

export function mapOverview(value: unknown): AdminOverviewWire {
  const raw = obj(unwrap(value)) ?? {};
  const primary = metricList(raw.primary);
  const rank = (metric: AdminMetric) => {
    const index = PRIMARY_ORDER.indexOf(countKey(metric.id));
    return index === -1 ? PRIMARY_ORDER.length : index;
  };
  primary.sort((a, b) => rank(a) - rank(b));
  return {
    primary,
    secondary: metricList(raw.secondary ?? raw.performance),
    activeSos: raw.activeSos ? mapSos(raw.activeSos) : null,
  };
}

const SECTION_TITLE: Record<string, [string, string]> = {
  adoption: ["Adoption", "Who is using paid rides, and how much."],
  verification: ["Verification", "How quickly drivers are reviewed and approved."],
  performance: ["Ride performance", "How often requests are matched and completed."],
  safety: ["Safety", "Incidents and SOS alerts, and how fast they close."],
  ratings: ["Ratings", "Two-way ratings from the network."],
  retention: ["Retention", "Members who come back for another ride."],
};

export function mapReports(value: unknown): ReportSection[] {
  const body = unwrap(value);
  const sections = Array.isArray(body) ? body : list(obj(body)?.sections);
  return sections.flatMap((entry) => {
    const raw = obj(entry);
    const id = str(raw?.id);
    if (!raw || !id) return [];
    const [title, description] = SECTION_TITLE[id] ?? [humanise(id), ""];
    return [{
      id,
      title: str(raw.title) ?? title,
      description: str(raw.description) ?? description,
      metrics: metricList(raw.metrics),
      series: list(raw.series).flatMap((point) => {
        const item = obj(point);
        const pointValue = num(item?.value);
        if (!item || pointValue === undefined) return [];
        const label = str(item.label) ?? str(item.date) ?? "";
        return [{ label: shortDay(label), value: pointValue, secondary: num(item.secondary) }];
      }),
    }];
  });
}

/** Daily series arrive as ISO dates; the bar chart wants short labels. */
function shortDay(label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(label)) return label;
  const date = new Date(`${label.slice(0, 10)}T12:00:00Z`);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

// ─── Driver applications ──────────────────────────────────────────────────────

const VERIFICATION_STATUS = new Set<string>(Object.values(VerificationStatus));

export function mapVerificationStatus(value: unknown): VerificationStatus {
  const status = upper(value);
  if (VERIFICATION_STATUS.has(status)) return status as VerificationStatus;
  if (status === "PENDING" || status === "UNDER_REVIEW" || status === "IN_REVIEW") return VerificationStatus.DOCUMENT_REVIEW;
  if (status === "VERIFIED" || status === "ACTIVE") return VerificationStatus.APPROVED;
  return VerificationStatus.SUBMITTED;
}

/**
 * Document types. The backend says `ROADWORTHINESS_CERTIFICATE`; the screens
 * say `ROADWORTHINESS`. Both directions go through these two functions.
 */
export function mapDocumentType(value: unknown): DocumentType | null {
  const type = upper(value);
  if (type === "ROADWORTHINESS_CERTIFICATE") return DocumentType.ROADWORTHINESS;
  return (Object.values(DocumentType) as string[]).includes(type) ? (type as DocumentType) : null;
}

export function documentTypeToWire(type: string): string {
  return type === DocumentType.ROADWORTHINESS ? "ROADWORTHINESS_CERTIFICATE" : type;
}

const DOCUMENT_LABEL: Record<DocumentType, string> = {
  GOVERNMENT_ID: "NIN slip",
  PROFILE_PHOTO: "Profile photo",
  DRIVERS_LICENCE: "Driver's licence",
  VEHICLE_REGISTRATION: "Vehicle registration",
  INSURANCE: "Insurance certificate",
  ROADWORTHINESS: "Roadworthiness certificate",
  VEHICLE_PHOTO: "Vehicle photo",
  GUARANTOR_PHOTO: "Guarantor photo",
};

const DOCUMENT_STATUS = new Set<string>(Object.values(DocumentStatus));

function mapDocument(value: unknown): VerificationDocument | null {
  const raw = obj(value);
  const type = mapDocumentType(raw?.type);
  if (!raw || !type) return null;
  const status = upper(raw.status);
  const source = str(raw.url) ?? str(raw.base64) ?? str(raw.content);
  const mimeType = str(raw.mimeType);
  return {
    // The review routes address documents by type, so the type is the id.
    id: type,
    type,
    label: str(raw.label) ?? DOCUMENT_LABEL[type],
    status: (DOCUMENT_STATUS.has(status) ? status : source ? DocumentStatus.UPLOADED : DocumentStatus.MISSING) as DocumentStatus,
    fileName: str(raw.fileName) ?? (source ? DOCUMENT_LABEL[type] : undefined),
    mimeType,
    fileType: mimeType ? mimeType.split("/").pop()?.toUpperCase() : undefined,
    sizeBytes: num(raw.sizeBytes),
    uploadedAt: str(raw.uploadedAt),
    expiresAt: str(raw.expiresAt),
    note: str(raw.note),
    source: source ? accountDocumentSource(source) : undefined,
  };
}

const INSPECTION_STATUS = new Set<string>(Object.values(InspectionStatus));

function mapInspectionStatus(value: unknown): InspectionStatus | undefined {
  const status = upper(value);
  return INSPECTION_STATUS.has(status) ? (status as InspectionStatus) : undefined;
}

function mapComment(value: unknown, index: number): ReviewComment | null {
  const raw = obj(value);
  const body = str(raw?.body);
  if (!raw || !body) return null;
  const documentType = mapDocumentType(raw.documentType);
  return {
    id: str(raw.id) ?? `comment-${index}`,
    author: personName(raw.author) ?? "Oversight team",
    body,
    at: str(raw.at) ?? str(raw.createdAt) ?? new Date(0).toISOString(),
    visibility: upper(raw.visibility) === "APPLICANT" ? "APPLICANT" : "INTERNAL",
    documentId: documentType ?? undefined,
  };
}

export function mapComment0(value: unknown): ReviewComment | null {
  return mapComment(unwrap(value), 0);
}

/** The review timeline, derived from the application status. */
function verificationSteps(status: VerificationStatus, submittedAt: string | undefined, documentsDone: boolean): VerificationStep[] {
  const order: VerificationStatus[] = [
    VerificationStatus.SUBMITTED,
    VerificationStatus.DOCUMENT_REVIEW,
    VerificationStatus.INSPECTION_REQUIRED,
    VerificationStatus.INSPECTION_SCHEDULED,
    VerificationStatus.FINAL_REVIEW,
    VerificationStatus.APPROVED,
  ];
  const at = Math.max(0, order.indexOf(status));
  const stage = (done: boolean, active: boolean): VerificationStep["status"] =>
    status === VerificationStatus.REJECTED ? (done ? "COMPLETE" : "BLOCKED") : done ? "COMPLETE" : active ? "ACTIVE" : "PENDING";
  return [
    { id: "submitted", label: "Application submitted", description: "Details and documents received.", status: "COMPLETE", completedAt: submittedAt },
    { id: "documents", label: "Document review", description: "Each document checked against the applicant's details.", status: stage(documentsDone || at > 1, at <= 1 || status === VerificationStatus.CHANGES_REQUIRED) },
    { id: "inspection", label: "Vehicle inspection", description: "The vehicle is seen in person.", status: stage(at > 3, at === 2 || at === 3) },
    { id: "final", label: "Final review", description: "A last look before approval.", status: stage(status === VerificationStatus.APPROVED, at === 4) },
  ];
}

const STATUS_DETAIL: Partial<Record<VerificationStatus, string>> = {
  SUBMITTED: "Waiting for a reviewer.",
  DOCUMENT_REVIEW: "Documents are being checked.",
  INSPECTION_REQUIRED: "A vehicle inspection needs to be booked.",
  INSPECTION_SCHEDULED: "The vehicle inspection is booked.",
  FINAL_REVIEW: "Ready for a final decision.",
  APPROVED: "Approved to drive.",
  CHANGES_REQUIRED: "Waiting for the applicant to make changes.",
  REJECTED: "The application was rejected.",
};

export function mapApplication(value: unknown): DriverVerification | null {
  const raw = obj(unwrap(value));
  const id = str(raw?.userId) ?? str(raw?.id);
  if (!raw || !id) return null;
  const status = mapVerificationStatus(raw.status);
  const documents = list(raw.documents).map(mapDocument).filter((doc): doc is VerificationDocument => doc !== null);
  const inspection = obj(raw.inspection);
  const inspectionStatus = mapInspectionStatus(inspection?.status);
  const scheduledAt = str(inspection?.scheduledAt);
  const documentsReady = num(raw.documentsReady) ?? (documents.length ? documents.filter((doc) => doc.status === DocumentStatus.VERIFIED || doc.status === DocumentStatus.UPLOADED).length : undefined);
  const documentsTotal = num(raw.documentsTotal) ?? (documents.length || undefined);
  const submittedAt = str(raw.submittedAt) ?? str(raw.createdAt);
  return {
    id,
    driverId: id,
    applicantName: str(raw.applicantName) ?? str(raw.displayName) ?? "Applicant",
    applicantAvatarUrl: str(raw.avatarUrl) ?? str(raw.applicantAvatarUrl),
    track: mapTrack(raw.track),
    tracks: mapTracks(raw.track),
    status,
    submittedAt,
    updatedAt: str(raw.updatedAt) ?? submittedAt ?? new Date(0).toISOString(),
    documents,
    documentsReady,
    documentsTotal,
    steps: verificationSteps(status, submittedAt, documents.length > 0 && documents.every((doc) => doc.status === DocumentStatus.VERIFIED)),
    inspection: {
      required: bool(inspection?.required) ?? true,
      scheduled: Boolean(scheduledAt) || inspectionStatus === InspectionStatus.SCHEDULED,
      scheduledAt,
      location: str(inspection?.location),
      note: str(inspection?.note),
      status: inspectionStatus,
      lastCompletedAt: str(inspection?.lastCompletedAt),
      nextDueAt: str(inspection?.nextDueAt),
    },
    vehicle: raw.vehicle ? mapVehicle(raw.vehicle) : undefined,
    statusDetail: str(raw.statusDetail) ?? STATUS_DETAIL[status] ?? "",
    changesRequested: list(raw.changesRequested).map(str).filter((item): item is string => item !== undefined),
    reviewerNote: str(raw.reviewerNote),
    comments: list(raw.comments).map(mapComment).filter((comment): comment is ReviewComment => comment !== null),
  };
}

export function mapApplicationDocument(value: unknown, fallbackType: string): VerificationDocument | null {
  const raw = obj(unwrap(value));
  return mapDocument(raw && raw.type ? raw : { ...(raw ?? {}), type: fallbackType });
}

// ─── People ───────────────────────────────────────────────────────────────────

function mapAvailability(value: unknown): DriverAvailability {
  const availability = upper(value);
  if (availability === "ONLINE" || availability === "AVAILABLE") return DriverAvailability.AVAILABLE;
  if (availability === "ON_TRIP") return DriverAvailability.ON_TRIP;
  return DriverAvailability.OFFLINE;
}

/** Roster filter → `availability` query value. */
export const AVAILABILITY_FILTER_ONLINE = "ONLINE";

function mapAccountStatus(value: unknown, active: boolean | undefined): DriverAccountStatus {
  const status = upper(value);
  if (status === "DEACTIVATED" || active === false) return DriverAccountStatus.DEACTIVATED;
  if (status === "FLAGGED") return DriverAccountStatus.FLAGGED;
  return DriverAccountStatus.ACTIVE;
}

export function mapDriver(value: unknown): Driver | null {
  const raw = obj(unwrap(value));
  const who = person(raw);
  if (!raw || !who.id) return null;
  const stats = obj(raw.stats) ?? {};
  const inspection = obj(raw.inspection);
  const affiliation = obj(raw.affiliation);
  const guarantor = obj(affiliation?.guarantor);
  const accountStatus = mapAccountStatus(raw.accountStatus, bool(raw.active) ?? bool(raw.isActive));
  const weekEarnings = mapAmount(stats.weekEarnings);
  const rating = num(raw.rating) ?? num(stats.rating);
  const nextDueAt = str(inspection?.nextDueAt);
  return {
    id: who.id,
    fullName: who.name,
    email: str(raw.email) ?? "",
    phone: str(raw.phone) ?? "",
    role: UserRole.DRIVER,
    avatarUrl: who.avatarUrl,
    membershipStatus: MembershipStatus.VERIFIED,
    joinedAt: str(raw.joinedAt) ?? str(raw.createdAt) ?? new Date(0).toISOString(),
    ninVerified: bool(raw.ninVerified),
    track: mapTrack(raw.track),
    eligibleTracks: mapTracks(raw.track),
    accountStatus,
    deactivationReason: str(raw.deactivationReason),
    availability: accountStatus === DriverAccountStatus.DEACTIVATED ? DriverAvailability.OFFLINE : mapAvailability(raw.availability),
    rating: rating ?? 0,
    totalTrips: num(raw.completedRides) ?? num(stats.completedRides) ?? 0,
    vehicle: mapVehicle(raw.vehicle),
    verificationStatus: mapVerificationStatus(raw.verificationStatus),
    earningsSummary: weekEarnings !== undefined || num(stats.weekRides) !== undefined
      ? { weekToDate: weekEarnings ?? 0, weekTrips: num(stats.weekRides) ?? 0, averageRating: rating ?? 0, dailySeries: [] } as Driver["earningsSummary"]
      : undefined,
    flagged: accountStatus === DriverAccountStatus.FLAGGED || bool(raw.flagged) === true,
    affiliation: affiliation
      ? {
          isKoinoniaWorker: bool(affiliation.isKoinoniaWorker) ?? false,
          department: str(affiliation.department),
          guarantor: guarantor ? { name: str(guarantor.name) ?? "", phone: "", relationship: str(guarantor.relationship) ?? "" } : undefined,
        }
      : undefined,
    inspection: inspection
      ? {
          status: mapInspectionStatus(inspection.status) ?? InspectionStatus.CURRENT,
          lastCompletedAt: str(inspection.lastCompletedAt),
          nextDueAt: nextDueAt ?? str(inspection.scheduledAt) ?? "",
          scheduledAt: str(inspection.scheduledAt),
          location: str(inspection.location),
          note: str(inspection.note),
        }
      : undefined,
  };
}

const MEMBERSHIP = new Set<string>(Object.values(MembershipStatus));

export function mapPassenger(value: unknown): Passenger | null {
  const raw = obj(unwrap(value));
  const who = person(raw);
  if (!raw || !who.id) return null;
  const membership = upper(raw.membershipStatus);
  const contacts = list(raw.trustedContacts).flatMap((entry, index) => {
    const contact = obj(entry);
    const name = str(contact?.name);
    if (!contact || !name) return [];
    // Phone numbers are never released on the record (admin doc).
    return [{ id: str(contact.id) ?? `contact-${index}`, name, phone: "", relationship: str(contact.relationship) }];
  });
  return {
    id: who.id,
    fullName: who.name,
    email: str(raw.email) ?? "",
    phone: "",
    role: UserRole.PASSENGER,
    avatarUrl: who.avatarUrl,
    membershipStatus: (MEMBERSHIP.has(membership) ? membership : MembershipStatus.UNVERIFIED) as MembershipStatus,
    joinedAt: str(raw.joinedAt) ?? str(raw.createdAt) ?? new Date(0).toISOString(),
    rating: num(raw.rating) ?? 0,
    totalRides: num(raw.completedRides) ?? num(raw.totalRides) ?? 0,
    trustedContacts: contacts,
    trustedContactCount: num(raw.trustedContactCount) ?? contacts.length,
    homeArea: str(raw.homeArea),
    restricted: bool(raw.restricted) ?? false,
  };
}

export function mapQualityFlag(value: unknown): QualityFlag | null {
  const raw = obj(value);
  const id = str(raw?.id);
  if (!raw || !id) return null;
  const subject = obj(raw.subject) ?? raw;
  const who = person(subject);
  const role = mapRole(subject.role);
  return {
    id,
    subjectId: who.id,
    subjectName: who.name,
    subjectAvatarUrl: who.avatarUrl,
    role,
    track: role === UserRole.DRIVER ? mapTrack(subject.track) : undefined,
    averageRating: num(raw.averageRating) ?? 0,
    lowRatings: num(raw.lowRatings) ?? 0,
    trips: num(raw.rides) ?? num(raw.trips) ?? 0,
    reason: str(raw.reason) ?? "Flagged for review",
    flaggedAt: str(raw.flaggedAt) ?? str(raw.createdAt) ?? new Date(0).toISOString(),
  };
}

// ─── Ride history rows (driver and passenger records) ─────────────────────────

export interface AdminRideRow {
  id: string;
  reference: string;
  destinationLabel: string;
  rideType: RideType;
  requestedAt: string;
  fare?: number;
  status: RideStatus;
  track: DriverTrack;
}

export function mapRideRow(value: unknown): AdminRideRow | null {
  const raw = obj(value);
  const id = str(raw?.id);
  if (!raw || !id) return null;
  return {
    id,
    reference: str(raw.reference) ?? id.slice(0, 8).toUpperCase(),
    destinationLabel: str(raw.destinationName) ?? placeName(raw.destination),
    rideType: upper(raw.rideType) === RideType.SHARED ? RideType.SHARED : RideType.PRIVATE,
    requestedAt: str(raw.createdAt) ?? str(raw.requestedAt) ?? new Date(0).toISOString(),
    fare: mapAmount(raw.total ?? raw.fare),
    status: mapRideStatus(raw.status),
    track: str(raw.track) ? mapTrack(raw.track) : DriverTrack.PROFESSIONAL,
  };
}

// ─── Live driver map (`GET /admin/drivers/live`) ──────────────────────────────

/** The ride statuses a driver can be busy with, as the backend sends them. */
export type LiveDriverRideStatus = "DRIVER_ASSIGNED" | "DRIVER_EN_ROUTE" | "DRIVER_ARRIVING" | "DRIVER_ARRIVED" | "IN_PROGRESS" | "PAUSED";

const LIVE_RIDE_STATUS = new Set<string>(["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVING", "DRIVER_ARRIVED", "IN_PROGRESS", "PAUSED"]);

/** One online driver's last ping. `currentRide` null means idle, otherwise busy. */
export interface LiveDriver {
  driverId: string;
  displayName: string;
  phone: string;
  lat: number;
  lng: number;
  heading: number | null;
  speedMps: number | null;
  availableSeats: number;
  lastSeenAt: string;
  currentRide: { rideId: string; status: LiveDriverRideStatus } | null;
}

export interface LiveDriversSnapshot {
  items: LiveDriver[];
  total: number;
}

export function mapLiveDriver(value: unknown): LiveDriver | null {
  const raw = obj(value);
  const driverId = str(raw?.driverId) ?? str(raw?.id);
  const lat = num(raw?.lat);
  const lng = num(raw?.lng);
  // A driver without a usable fix can't be placed; drop it rather than draw it at 0,0.
  if (!raw || !driverId || lat === undefined || lng === undefined || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const ride = obj(raw.currentRide);
  const rideId = str(ride?.rideId) ?? str(ride?.id);
  const status = upper(ride?.status);
  const heading = num(raw.heading);
  const speed = num(raw.speedMps);
  return {
    driverId,
    displayName: str(raw.displayName) ?? str(raw.name) ?? "Driver",
    phone: str(raw.phone) ?? "",
    lat,
    lng,
    heading: heading === undefined ? null : ((heading % 360) + 360) % 360,
    speedMps: speed === undefined || speed < 0 ? null : speed,
    availableSeats: Math.max(0, Math.round(num(raw.availableSeats) ?? 0)),
    lastSeenAt: str(raw.lastSeenAt) ?? new Date(0).toISOString(),
    currentRide: ride && rideId
      ? { rideId, status: (LIVE_RIDE_STATUS.has(status) ? status : "IN_PROGRESS") as LiveDriverRideStatus }
      : null,
  };
}

export function mapLiveDrivers(value: unknown): LiveDriversSnapshot {
  const body = unwrap(value);
  const raw = obj(body);
  const items = (Array.isArray(body) ? body : list(raw?.items)).map(mapLiveDriver).filter((entry): entry is LiveDriver => entry !== null);
  return { items, total: num(raw?.total) ?? items.length };
}

// ─── Socket frames ────────────────────────────────────────────────────────────

export type AdminSocketEvent =
  | { kind: "ride"; rideId: string | null }
  | { kind: "sos"; rideId: string | null }
  | { kind: "incident"; incidentId: string | null; rideId: string | null }
  | { kind: "resync" };

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** One server frame → a refetch hint, or null for pongs and unknown events. */
export function parseAdminFrame(data: unknown): AdminSocketEvent | null {
  let frame: unknown = data;
  if (typeof data === "string") {
    try { frame = JSON.parse(data); } catch { return null; }
  }
  const outer = frame as { type?: unknown; event?: { rideId?: unknown; payload?: Record<string, unknown> } } | null;
  if (!outer || outer.type !== "event" || !outer.event) return null;
  const payload = outer.event.payload ?? {};
  const type = text(payload.type) ?? "";
  const rideId = text(outer.event.rideId) ?? text(payload.rideId);
  if (type === "admin.resync_required") return { kind: "resync" };
  // Location fixes arrive every few seconds; the admin pages show no map, so
  // they are not worth a refetch.
  if (type === "admin.ride.changed" || type === "ride.updated") return { kind: "ride", rideId };
  if (type.startsWith("sos.")) return { kind: "sos", rideId };
  if (type.startsWith("incident.")) {
    const incident = payload.incident as { id?: unknown } | undefined;
    return { kind: "incident", incidentId: text(payload.incidentId) ?? text(incident?.id), rideId };
  }
  return null;
}
