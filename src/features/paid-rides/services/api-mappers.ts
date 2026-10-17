import { RideServiceError } from "../domain/errors.ts";
import type {
  CancelledBy,
  ContactOptions,
  DriverAvailability,
  FareEstimate,
  FareQuote,
  GeoPoint,
  LiveLocation,
  Money,
  PaymentMethodKind,
  PaymentStatus,
  Place,
  PlaceSource,
  Ride,
  RideEvent,
  RideEventPayload,
  RideOffer,
  RideOption,
  RideSummary,
  RouteGeometry,
  SosStatus,
  Vehicle,
  VehicleClass,
  Viewer,
  WaitingInfo,
} from "../domain/types.ts";

/**
 * Wire → domain mapping for the real Paid Rides backend.
 *
 * The REST contract is docs/paid-rides/openapi.json (RideProjection,
 * FareEstimateDto, RideOfferView, ViewerDto, …); the socket envelope is in
 * docs/paid-rides/API_AND_WEBSOCKET_SPEC.md. Most shapes already match the
 * domain model, so these functions mainly normalise enums and fill defaults.
 * Everything is read defensively: a missing optional field must degrade the
 * screen, never crash it.
 *
 * Pure and dependency-free so the unit tests can run it under Node.
 */

type Json = Record<string, unknown>;

function obj(value: unknown): Json | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// ─── Primitives ───────────────────────────────────────────────────────────────

export function mapPoint(value: unknown): GeoPoint | null {
  const raw = obj(value);
  if (!raw) return null;
  const lat = num(raw.lat);
  // `GeoPoint` elsewhere in the backend uses `long`; accept either.
  const lng = num(raw.lng) ?? num(raw.long) ?? num(raw.lon);
  return lat === undefined || lng === undefined || Math.abs(lat) > 90 || Math.abs(lng) > 180 ? null : { lat, lng };
}

const ZERO_POINT: GeoPoint = { lat: 0, lng: 0 };

export function mapMoney(value: unknown): Money | null {
  const raw = obj(value);
  const amountMinor = num(raw?.amountMinor);
  if (!raw || amountMinor === undefined || !Number.isSafeInteger(amountMinor) || amountMinor < 0) return null;
  return { amountMinor, currency: str(raw.currency) ?? "NGN" };
}

const NO_MONEY: Money = { amountMinor: 0, currency: "NGN" };

const PLACE_SOURCES = new Set<PlaceSource>(["search", "recent", "saved", "current-location", "map-pin"]);

export function mapPlace(value: unknown): Place {
  const raw = obj(value) ?? {};
  const point = mapPoint(raw.point) ?? ZERO_POINT;
  const source = str(raw.source) as PlaceSource | undefined;
  return {
    id: str(raw.id) ?? `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`,
    name: str(raw.name) ?? "Pinned location",
    secondary: str(raw.secondary) ?? "",
    point,
    source: source && PLACE_SOURCES.has(source) ? source : "search",
  };
}

/** The backend's `Place` takes the same fields; empty strings are dropped. */
export function placeToWire(place: Place): Json {
  return {
    id: place.id || null,
    name: place.name,
    secondary: place.secondary || null,
    point: { lat: place.point.lat, lng: place.point.lng },
    source: place.source,
  };
}

/**
 * Ride route geometry. In openapi.json `route` on RideProjection,
 * FareEstimateDto and ApproachView wrongly references the Free Bus `Route`
 * schema (name, start_point, stops…). The real payload is expected to be
 * `{ points, distanceMeters, durationSeconds, source }`; anything else falls
 * back to a straight line between the ends, marked approximate so it is
 * never presented as the road route.
 */
export function mapRoute(value: unknown, ends?: { from: GeoPoint; to: GeoPoint }): RouteGeometry {
  const raw = obj(value) ?? {};
  const points = list(raw.points).map(mapPoint).filter((point): point is GeoPoint => point !== null);
  const usable = points.length >= 2;
  return {
    points: usable ? points : ends ? [ends.from, ends.to] : points,
    distanceMeters: num(raw.distanceMeters) ?? num(raw.distance_meters) ?? 0,
    durationSeconds: num(raw.durationSeconds) ?? num(raw.duration_seconds) ?? 0,
    source: usable && raw.source === "road" ? "road" : "approximate",
  };
}

export function mapLocation(value: unknown): LiveLocation | null {
  const raw = obj(value);
  const point = mapPoint(raw?.point);
  if (!raw || !point || !str(raw.recordedAt) || !Number.isFinite(Date.parse(String(raw.recordedAt)))) return null;
  return {
    point,
    heading: num(raw.heading) ?? null,
    speedMps: num(raw.speedMps) ?? null,
    accuracyMeters: num(raw.accuracyMeters) ?? null,
    recordedAt: String(raw.recordedAt),
  };
}

const VEHICLE_CLASSES = new Set<VehicleClass>(["compact", "sedan", "suv", "van", "premium"]);

export function mapVehicleClass(value: unknown): VehicleClass {
  const lowered = str(value)?.toLowerCase() as VehicleClass | undefined;
  return lowered && VEHICLE_CLASSES.has(lowered) ? lowered : "sedan";
}

export function mapVehicle(value: unknown): Vehicle | undefined {
  const raw = obj(value);
  if (!raw) return undefined;
  return {
    capacity: num(raw.capacity),
    make: str(raw.make) ?? "",
    model: str(raw.model) ?? "",
    color: str(raw.color) ?? "",
    colorHex: str(raw.colorHex),
    plate: str(raw.plate) ?? "",
    vehicleClass: mapVehicleClass(raw.vehicleClass),
  };
}

/**
 * `ContactView.call` is `none | masked | direct`. v1 has no masked-calling
 * provider, so the server sends `none` (or `direct` with a `tel:` href).
 * A call button only ever appears with a server-issued href.
 */
export function mapContact(value: unknown): ContactOptions {
  const raw = obj(value) ?? {};
  const call = str(raw.call)?.toLowerCase();
  const href = str(raw.callHref);
  const callHref = href && /^tel:\+?[\d ()-]+$/.test(href) ? href : undefined;
  const mode = call === "masked" || call === "direct" ? call : "none";
  return {
    call: mode !== "none" && callHref ? mode : "none",
    callHref: mode !== "none" ? callHref : undefined,
    chat: raw.chat === true,
  };
}

// ─── Fares and estimates ──────────────────────────────────────────────────────

export function mapFare(value: unknown): FareQuote {
  const raw = obj(value) ?? {};
  // A bare Money (as in the spec's offer example) is read as the total.
  const total = mapMoney(raw.total) ?? mapMoney(raw);
  if (!total) throw new RideServiceError("unavailable");
  const range = obj(raw.range);
  const low = mapMoney(range?.low);
  const high = mapMoney(range?.high);
  const waiting = obj(raw.waiting);
  const perMinute = mapMoney(waiting?.perMinute);
  return {
    total,
    range: low && high && (low.amountMinor !== high.amountMinor) ? { low, high } : undefined,
    breakdown: list(raw.breakdown).flatMap((line) => {
      const item = obj(line);
      const amount = mapMoney(item?.amount);
      return item && amount ? [{ code: str(item.code) ?? "other", label: str(item.label) ?? "", amount }] : [];
    }),
    isEstimate: raw.isEstimate !== false,
    waiting: waiting && perMinute ? { freeMinutes: num(waiting.freeMinutes) ?? 0, perMinute } : undefined,
  };
}

const PAYMENT_KINDS = new Set<PaymentMethodKind>(["cash", "card", "wallet", "transfer"]);

export function mapEstimate(value: unknown, ends: { pickup: Place; destination: Place }): FareEstimate {
  const raw = obj(value) ?? {};
  if (!str(raw.estimateId) || !str(raw.expiresAt) || !Number.isFinite(Date.parse(String(raw.expiresAt)))) throw new RideServiceError("unavailable");
  const options: RideOption[] = list(raw.options).flatMap((entry) => {
    const item = obj(entry);
    const option = obj(item?.option);
    if (!item || !option || !str(option.id)) return [];
    return [
      {
        id: str(option.id)!,
        name: str(option.name) ?? "Ride",
        description: str(option.description) ?? "",
        vehicleClass: mapVehicleClass(option.vehicleClass),
        capacity: num(option.capacity) ?? 4,
        shared: option.shared === true,
        pickupEtaSeconds: num(item.pickupEtaSeconds) ?? null,
        fare: mapFare(item.fare),
        available: item.available !== false,
        unavailableReason: str(item.unavailableReason),
      },
    ];
  });
  return {
    estimateId: str(raw.estimateId) ?? "",
    expiresAt: str(raw.expiresAt) ?? new Date(Date.now() + 5 * 60_000).toISOString(),
    route: mapRoute(raw.route, { from: ends.pickup.point, to: ends.destination.point }),
    options,
    paymentMethods: list(raw.paymentMethods).flatMap((entry) => {
      const item = obj(entry);
      if (!item || !str(item.id)) return [];
      const kind = str(item.kind)?.toLowerCase() as PaymentMethodKind | undefined;
      return [{ id: str(item.id)!, kind: kind && PAYMENT_KINDS.has(kind) ? kind : "cash", label: str(item.label) ?? "Cash" }];
    }),
    defaultPaymentMethodId: str(raw.defaultPaymentMethodId) ?? null,
  };
}

// ─── Ride projection ──────────────────────────────────────────────────────────

const PAYMENT_STATUSES: Record<string, PaymentStatus> = {
  not_required: "not_required",
  free: "not_required",
  pending: "pending",
  authorized: "authorized",
  paid: "paid",
  failed: "failed",
};

function mapPaymentStatus(value: unknown): PaymentStatus {
  return PAYMENT_STATUSES[str(value)?.toLowerCase() ?? ""] ?? "pending";
}

function mapCancelledBy(value: unknown): CancelledBy {
  const by = str(value)?.toLowerCase();
  if (by === "passenger" || by === "rider") return "passenger";
  if (by === "driver") return "driver";
  return "system";
}

const SOS_STATUSES = new Set<SosStatus>(["none", "sent", "acknowledged", "resolved"]);

function mapSosStatus(value: unknown): SosStatus {
  const status = str(value)?.toLowerCase() as SosStatus | undefined;
  return status && SOS_STATUSES.has(status) ? status : "none";
}

function mapWaiting(value: unknown): WaitingInfo | undefined {
  const raw = obj(value);
  const charge = mapMoney(raw?.charge);
  if (!raw || !charge) return undefined;
  return {
    freeUntil: str(raw.freeUntil) ?? null,
    freeSeconds: num(raw.freeSeconds) ?? 0,
    waitedSeconds: num(raw.waitedSeconds) ?? 0,
    billableMinutes: num(raw.billableMinutes) ?? 0,
    perMinute: mapMoney(raw.perMinute) ?? { ...NO_MONEY, currency: charge.currency },
    charge,
  };
}

function optionalString(value: unknown): string | undefined {
  return str(value);
}

export function mapRide(value: unknown): Ride {
  const raw = obj(value) ?? {};
  if (!Number.isSafeInteger(raw.version) || Number(raw.version) < 0) throw new RideServiceError("unavailable");
  if (!str(raw.id) || !mapPoint(obj(raw.pickup)?.point) || !mapPoint(obj(raw.destination)?.point) || !["REQUESTED", "SEARCHING", "NO_DRIVERS", "DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVING", "DRIVER_ARRIVED", "IN_PROGRESS", "PAUSED", "COMPLETED", "CANCELLED"].includes(String(raw.status).toUpperCase())) throw new RideServiceError("unavailable");
  const pickup = mapPlace(raw.pickup);
  const destination = mapPlace(raw.destination);
  const option = obj(raw.option) ?? {};
  const payment = obj(raw.payment) ?? {};
  const driver = obj(raw.driver);
  const passenger = obj(raw.passenger);
  const approach = obj(raw.approach);
  const progress = obj(raw.progress);
  const cancellation = obj(raw.cancellation);
  const timestamps = obj(raw.timestamps) ?? {};
  const rating = obj(raw.rating);
  const createdAt = str(raw.createdAt) ?? new Date().toISOString();

  return {
    id: str(raw.id) ?? "",
    version: num(raw.version) ?? Number.NaN,
    status: (str(raw.status)?.toUpperCase() ?? "REQUESTED") as Ride["status"],
    createdAt,
    updatedAt: str(raw.updatedAt) ?? createdAt,
    pickup,
    destination,
    route: mapRoute(raw.route, { from: pickup.point, to: destination.point }),
    option: {
      id: str(option.id) ?? "",
      name: str(option.name) ?? "Ride",
      vehicleClass: mapVehicleClass(option.vehicleClass),
      capacity: num(option.capacity) ?? 4,
      shared: option.shared === true,
    },
    fare: mapFare(raw.fare),
    payment: { status: mapPaymentStatus(payment.status), methodLabel: str(payment.methodLabel) ?? "Cash" },
    driver: driver
      ? {
          displayName: str(driver.displayName) ?? "Your driver",
          avatarUrl: str(driver.avatarUrl),
          rating: num(driver.rating),
          completedRides: num(driver.completedRides),
          verified: driver.verified === true,
          vehicle: mapVehicle(driver.vehicle) ?? { make: "", model: "", color: "", plate: "", vehicleClass: mapVehicleClass(option.vehicleClass) },
          contact: mapContact(driver.contact),
        }
      : undefined,
    passenger: passenger
      ? {
          displayName: str(passenger.displayName) ?? "Passenger",
          avatarUrl: str(passenger.avatarUrl),
          rating: num(passenger.rating),
          contact: mapContact(passenger.contact),
        }
      : undefined,
    driverEarning: mapMoney(raw.driverEarning) ?? undefined,
    driverLocation: mapLocation(raw.driverLocation) ?? undefined,
    approach: approach
      ? {
          etaSeconds: num(approach.etaSeconds) ?? 0,
          distanceMeters: num(approach.distanceMeters) ?? 0,
          route: obj(approach.route) ? mapRoute(approach.route) : undefined,
        }
      : undefined,
    progress: progress ? { etaSeconds: num(progress.etaSeconds) ?? 0, remainingMeters: num(progress.remainingMeters) ?? 0 } : undefined,
    cancellation: cancellation
      ? { by: mapCancelledBy(cancellation.by), reason: str(cancellation.reason), fee: mapMoney(cancellation.fee) ?? undefined }
      : undefined,
    timestamps: {
      assignedAt: optionalString(timestamps.assignedAt),
      arrivedAt: optionalString(timestamps.arrivedAt),
      startedAt: optionalString(timestamps.startedAt),
      completedAt: optionalString(timestamps.completedAt),
      cancelledAt: optionalString(timestamps.cancelledAt),
    },
    sos: { status: mapSosStatus(obj(raw.sos)?.status) },
    rating: rating && num(rating.stars) !== undefined ? { stars: num(rating.stars)!, submittedAt: str(rating.submittedAt) ?? createdAt } : undefined,
    shareUrl: str(raw.shareUrl),
    tripPin: str(raw.tripPin),
    waiting: mapWaiting(raw.waiting),
  };
}

/** `RideEnvelope { ride? }` → the ride, or null when there is none. */
export function mapRideEnvelope(value: unknown): Ride | null {
  const raw = obj(value);
  if (!raw || !("ride" in raw) || (raw.ride !== null && !obj(raw.ride))) throw new RideServiceError("unavailable");
  const ride = raw.ride;
  return obj(ride) ? mapRide(ride) : null;
}

// ─── Viewer, availability, history ────────────────────────────────────────────

/**
 * `ViewerDto.roles` carries backend role names (`User`, `Driver`, …). Anyone
 * signed in may book a ride; the driver screens need a `driver` role, matched
 * case-insensitively.
 */
export function mapViewer(value: unknown): Viewer {
  const raw = obj(value) ?? {};
  if (!str(raw.displayName) || !Array.isArray(raw.roles) || raw.roles.length === 0) throw new RideServiceError("unavailable");
  const roles = list(raw.roles).map((role) => String(role).toLowerCase());
  return {
    displayName: str(raw.displayName) ?? "",
    avatarUrl: str(raw.avatarUrl),
    roles: roles.includes("driver") ? ["passenger", "driver"] : ["passenger"],
    vehicle: mapVehicle(raw.vehicle),
  };
}

const AVAILABILITY = new Set<DriverAvailability>(["OFFLINE", "ONLINE", "ON_TRIP"]);

/** `AvailabilityEnvelope { availability: { status, lastLocation, updatedAt } }`. */
export function mapAvailability(value: unknown): DriverAvailability {
  const raw = obj(value);
  const inner = raw?.availability;
  const status = str(obj(inner)?.status) ?? str(inner) ?? str(raw?.status);
  const upper = status?.toUpperCase() as DriverAvailability | undefined;
  return upper && AVAILABILITY.has(upper) ? upper : "OFFLINE";
}

export function mapSummary(value: unknown): RideSummary {
  const raw = obj(value) ?? {};
  return {
    id: str(raw.id) ?? "",
    status: (str(raw.status)?.toUpperCase() ?? "COMPLETED") as RideSummary["status"],
    createdAt: str(raw.createdAt) ?? new Date(0).toISOString(),
    pickupName: str(raw.pickupName) ?? "",
    destinationName: str(raw.destinationName) ?? "",
    optionName: str(raw.optionName) ?? "Ride",
    vehicleClass: mapVehicleClass(raw.vehicleClass),
    total: mapMoney(raw.total),
    distanceMeters: num(raw.distanceMeters) ?? 0,
    durationSeconds: num(raw.durationSeconds) ?? null,
    counterpartName: str(raw.counterpartName),
    ratingGiven: num(raw.ratingGiven),
  };
}

export function mapHistoryPage(value: unknown): { items: RideSummary[]; nextCursor: string | null } {
  const raw = obj(value) ?? {};
  return { items: list(raw.items).map(mapSummary), nextCursor: str(raw.nextCursor) ?? null };
}

// ─── Offers and realtime events ───────────────────────────────────────────────

export function mapOffer(value: unknown, receivedAt: string = new Date().toISOString()): RideOffer {
  const raw = obj(value) ?? {};
  const option = obj(raw.option) ?? {};
  const passenger = obj(raw.passenger) ?? {};
  const fullName = [str(passenger.firstName), str(passenger.lastName)?.charAt(0)].filter(Boolean).join(" ");
  return {
    offerId: str(raw.offerId) ?? "",
    rideId: str(raw.rideId) ?? "",
    expiresAt: str(raw.expiresAt) ?? null,
    receivedAt,
    pickup: mapPlace(raw.pickup),
    destination: obj(raw.destination) ? mapPlace(raw.destination) : null,
    pickupDistanceMeters: num(raw.pickupDistanceMeters) ?? 0,
    pickupEtaSeconds: num(raw.pickupEtaSeconds) ?? 0,
    tripDistanceMeters: num(raw.tripDistanceMeters) ?? null,
    tripDurationSeconds: num(raw.tripDurationSeconds) ?? null,
    earning: mapMoney(raw.driverEarning) ?? mapMoney(obj(raw.fare)?.total) ?? null,
    passenger: { displayName: str(passenger.displayName) ?? (fullName || "Passenger"), rating: num(passenger.rating) },
    optionName: str(option.name) ?? "Ride",
    vehicleClass: mapVehicleClass(option.vehicleClass),
    shared: option.shared === true,
  };
}

/** Event types the frontend understands from this backend; others are dropped. */
function mapPayload(value: unknown, receivedAt: string): RideEventPayload | null {
  const raw = obj(value);
  const type = str(raw?.type);
  if (!raw || !type) return null;
  switch (type) {
    case "ride.updated":
      return obj(raw.ride) ? { type, ride: mapRide(raw.ride) } : null;
    case "ride.driver.location_updated": {
      const location = mapLocation(raw.location);
      if (!location) return null;
      const approach = obj(raw.approach);
      const progress = obj(raw.progress);
      return {
        type,
        location,
        approach: approach ? { etaSeconds: num(approach.etaSeconds) ?? 0, distanceMeters: num(approach.distanceMeters) ?? 0 } : undefined,
        progress: progress ? { etaSeconds: num(progress.etaSeconds) ?? 0, remainingMeters: num(progress.remainingMeters) ?? 0 } : undefined,
      };
    }
    case "driver.request.received":
      return obj(raw.offer) ? { type, offer: mapOffer(raw.offer, receivedAt) } : null;
    case "driver.request.expired":
      // The spec doesn't say whether `offerId` is sent; an empty id is matched by ride.
      return { type, offerId: str(raw.offerId) ?? str(obj(raw.offer)?.offerId) ?? "" };
    case "driver.request.withdrawn":
      return { type, offerId: str(raw.offerId) ?? "", reason: raw.reason === "cancelled" ? "cancelled" : "taken" };
    case "driver.availability.changed":
      return { type, availability: mapAvailability(raw) };
    case "ride.sos.acknowledged":
      return { type };
    default:
      return null;
  }
}

/**
 * Socket event envelope. `trustSeq: false` drops `seq`, so the session
 * de-duplicates by event id only and never reads a jump as missed events —
 * used while the backend's `seq` semantics are unconfirmed. Ride versions
 * still gate every snapshot.
 */
export function mapRealtimeEvent(value: unknown, options: { trustSeq: boolean }): RideEvent | null {
  const raw = obj(value);
  const id = str(raw?.id);
  if (!raw || !id) return null;
  const occurredAt = str(raw.occurredAt) ?? new Date().toISOString();
  let payload: RideEventPayload | null;
  try { payload = mapPayload(raw.payload, new Date().toISOString()); }
  catch { return null; } // A malformed server frame must not crash the socket listener.
  if (!payload) return null;
  return {
    id,
    rideId: str(raw.rideId) ?? null,
    seq: options.trustSeq ? (num(raw.seq) ?? null) : null,
    rideVersion: num(raw.rideVersion) ?? null,
    occurredAt,
    payload,
  };
}
