/**
 * Paid Rides domain model.
 *
 * These types describe what the frontend expects from the backend; the
 * contract is written up in docs/paid-rides/PAID_RIDES_BACKEND_REQUIREMENTS.md.
 * Everything here is a *projection* for one viewer: a passenger sees the
 * driver's public profile and never another rider's contact details; a
 * driver sees the passenger's approved display name and the earning, not the
 * passenger's payment method.
 *
 * Only erasable TypeScript lives in domain/ (no enums), so Node can run the
 * unit tests by stripping types.
 */

// ─── Geography ────────────────────────────────────────────────────────────────

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type PlaceSource = "search" | "recent" | "saved" | "current-location" | "map-pin";

export interface Place {
  id: string;
  /** Primary line, e.g. "Jabi Lake Mall". */
  name: string;
  /** Secondary context, e.g. "Bala Sokoto Way, Jabi, Abuja". */
  secondary: string;
  point: GeoPoint;
  source: PlaceSource;
}

/** Predictions are not bookable until their real coordinates are resolved. */
export type PlaceSuggestion = Omit<Place, "point"> & { point: GeoPoint | null };

export interface RouteGeometry {
  points: GeoPoint[];
  distanceMeters: number;
  durationSeconds: number;
  /** `approximate` means the road router was unavailable — never shown as exact. */
  source: "road" | "approximate";
}

export interface LiveLocation {
  point: GeoPoint;
  /** Degrees clockwise from north, when the device reports it. */
  heading: number | null;
  speedMps: number | null;
  accuracyMeters: number | null;
  /** Server-stamped where possible; used to reject stale updates. */
  recordedAt: string;
}

// ─── Money and fares ──────────────────────────────────────────────────────────

export interface Money {
  /** Minor units (kobo for NGN) — never floating-point naira. */
  amountMinor: number;
  currency: string;
}

export interface FareLine {
  /** base | distance | time | service_fee | shared_discount | booking_fee | … */
  code: string;
  label: string;
  amount: Money;
}

export interface FareQuote {
  total: Money;
  /** Present when the server quotes a range rather than a fixed price. */
  range?: { low: Money; high: Money };
  breakdown: FareLine[];
  /** True until the trip completes and the server settles the final fare. */
  isEstimate: boolean;
  /** Waiting charge policy once the driver has arrived, when the server sets one. */
  waiting?: WaitingPolicy;
}

export interface WaitingPolicy {
  freeMinutes: number;
  perMinute: Money;
}

/** Live waiting charge on a ride, from the server; the client never computes it. */
export interface WaitingInfo {
  freeUntil: string | null;
  freeSeconds: number;
  waitedSeconds: number;
  billableMinutes: number;
  perMinute: Money;
  charge: Money;
}

export type VehicleClass = "compact" | "sedan" | "suv" | "van" | "premium";

export interface RideOption {
  /** Server identifier for the product; never hard-coded in screens. */
  id: string;
  name: string;
  /** Short value statement, e.g. "Affordable everyday rides". */
  description: string;
  vehicleClass: VehicleClass;
  capacity: number;
  shared: boolean;
  /** Seconds until a driver could reach the pickup; null when unknown. */
  pickupEtaSeconds: number | null;
  fare: FareQuote;
  available: boolean;
  unavailableReason?: string;
}

export type PaymentMethodKind = "cash" | "card" | "wallet" | "transfer";

export interface PaymentMethodSummary {
  id: string;
  kind: PaymentMethodKind;
  label: string;
  last4?: string;
}

export interface FareEstimate {
  estimateId: string;
  /** Requests must be made before this instant or re-estimated. */
  expiresAt: string;
  route: RouteGeometry;
  options: RideOption[];
  paymentMethods: PaymentMethodSummary[];
  defaultPaymentMethodId: string | null;
}

export type PaymentStatus = "not_required" | "pending" | "authorized" | "paid" | "failed";

// ─── People and vehicles ──────────────────────────────────────────────────────

export interface Vehicle {
  capacity?: number;
  year?: number;
  verified?: boolean;
  make: string;
  model: string;
  color: string;
  /** Optional swatch so the vehicle glyph can match the real car. */
  colorHex?: string;
  plate: string;
  vehicleClass: VehicleClass;
}

export interface ContactOptions {
  /**
   * `masked` — a proxied number or call bridge (preferred).
   * `direct` — the backend explicitly allows a raw number.
   * `none` — calling is unavailable for this ride.
   */
  call: "masked" | "direct" | "none";
  /** A `tel:` href issued by the server for this ride only. */
  callHref?: string;
  chat: boolean;
}

export interface DriverBankAccount {
  bankName: string;
  accountNumber: string;
  accountName?: string;
}

export interface DriverPublicProfile {
  bankAccount?: DriverBankAccount;
  displayName: string;
  avatarUrl?: string;
  rating?: number;
  completedRides?: number;
  verified: boolean;
  vehicle: Vehicle;
  contact: ContactOptions;
}

export interface PassengerPublicProfile {
  displayName: string;
  avatarUrl?: string;
  rating?: number;
  contact: ContactOptions;
}

/** Another rider on a shared trip — anonymised unless the API approves more. */
export interface CoRider {
  alias: string;
  boarded: boolean;
}

export interface SharedRideInfo {
  riderCount: number;
  seatsAvailable: number;
  coRiders: CoRider[];
  /** The route may include another pickup or drop-off. */
  mayDetour: boolean;
  /** Upper bound the server allows a detour to add, in seconds. */
  maxExtraSeconds?: number;
}

export interface Viewer {
  displayName: string;
  avatarUrl?: string;
  roles: Array<"passenger" | "driver">;
  /** The driver's own approved vehicle, when the viewer drives. */
  vehicle?: Vehicle;
  account?: RideAccountProfile;
}

export interface AccountDocument {
  label: string;
  provided: boolean;
  source?: string;
}

export interface AccountUpdate {
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  city: string;
  country: string;
}

export interface RideAccountProfile {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  country: string;
  joinedAt: string;
  identityVerified: boolean;
  maskedNin?: string;
  vehicleId?: string;
  vehicleLoadFailed: boolean;
  documents: AccountDocument[];
  driver?: {
    status: string;
    track: string;
    licenceNumber: string;
    licenceClass: string;
    licenceExpiryDate: string;
    isKoinoniaWorker: boolean;
    department?: string;
    guarantorName?: string;
    guarantorPhone?: string;
    guarantorRelationship?: string;
  };
}

// ─── Ride lifecycle ───────────────────────────────────────────────────────────

/**
 * Server ride status. Frontend and backend must agree on this list; see the
 * transition table in domain/ride-status.ts.
 */
export type RideStatus =
  | "REQUESTED"
  | "SEARCHING"
  | "NO_DRIVERS"
  | "DRIVER_ASSIGNED"
  | "DRIVER_EN_ROUTE"
  | "DRIVER_ARRIVING"
  | "DRIVER_ARRIVED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED";

export type CancelledBy = "passenger" | "driver" | "system";

export type SosStatus = "none" | "sent" | "acknowledged" | "resolved";

export interface Ride {
  id: string;
  /** Monotonic per ride; bumped on every server-side change. */
  version: number;
  status: RideStatus;
  createdAt: string;
  updatedAt: string;

  pickup: Place;
  destination: Place;
  route: RouteGeometry;

  option: Pick<RideOption, "id" | "name" | "vehicleClass" | "capacity" | "shared">;
  fare: FareQuote;
  payment: { status: PaymentStatus; methodLabel: string };

  /** Present for the passenger once assigned. */
  driver?: DriverPublicProfile;
  /** Present for the driver. */
  passenger?: PassengerPublicProfile;
  /** Driver's earning for this trip, driver view only. */
  driverEarning?: Money;

  driverLocation?: LiveLocation;
  /** Driver → pickup, route-aware, while the driver is approaching. */
  approach?: { etaSeconds: number; distanceMeters: number; route?: RouteGeometry };
  /** Remaining trip to the destination while in progress. */
  progress?: { etaSeconds: number; remainingMeters: number };

  shared?: SharedRideInfo;
  cancellation?: { by: CancelledBy; reason?: string; fee?: Money };
  timestamps: {
    assignedAt?: string;
    arrivedAt?: string;
    startedAt?: string;
    completedAt?: string;
    cancelledAt?: string;
  };
  sos: { status: SosStatus };
  rating?: { stars: number; submittedAt: string };
  /** Live trip link the rider may share; issued by the server. */
  shareUrl?: string;
  /** When the product requires a trip PIN, the passenger sees it here. */
  tripPin?: string;
  /** Waiting time and charge after the driver arrived, when the server reports it. */
  waiting?: WaitingInfo;
}

export interface RideSummary {
  id: string;
  status: RideStatus;
  createdAt: string;
  pickupName: string;
  destinationName: string;
  optionName: string;
  vehicleClass: VehicleClass;
  total: Money | null;
  distanceMeters: number;
  durationSeconds: number | null;
  counterpartName?: string;
  ratingGiven?: number;
}

// ─── Driver side ──────────────────────────────────────────────────────────────

export type DriverAvailability = "OFFLINE" | "ONLINE" | "ON_TRIP";

export interface RideOffer {
  offerId: string;
  rideId: string;
  /** Server deadline. When absent the client falls back to a config value. */
  expiresAt: string | null;
  receivedAt: string;
  pickup: Place;
  /** Null when business rules hide the destination until acceptance. */
  destination: Place | null;
  pickupDistanceMeters: number;
  pickupEtaSeconds: number;
  tripDistanceMeters: number | null;
  tripDurationSeconds: number | null;
  earning: Money | null;
  passenger: { displayName: string; rating?: number };
  optionName: string;
  vehicleClass: VehicleClass;
  shared: boolean;
}

export type AcceptOutcome =
  | "accepted"
  | "already_taken"
  | "request_expired"
  | "driver_ineligible"
  | "network_error";

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export interface RideMessage {
  id: string;
  /** Client id used to reconcile an optimistic bubble with the server copy. */
  clientId?: string;
  rideId: string;
  from: "me" | "them" | "system";
  body: string;
  sentAt: string;
  status: MessageStatus;
}

// ─── Safety ───────────────────────────────────────────────────────────────────

export type EmergencyType = "medical" | "accident" | "threat" | "other";

export interface SosRequest {
  rideId: string;
  type: EmergencyType;
  location: GeoPoint | null;
  occurredAt: string;
}

export type SafetyReportCategory =
  | "unsafe_driving"
  | "harassment"
  | "vehicle_mismatch"
  | "route_concern"
  | "other";

export interface RatingInput {
  rideId: string;
  stars: number;
  tags: string[];
  comment?: string;
}

// ─── Realtime ─────────────────────────────────────────────────────────────────

export type ConnectionStatus = "idle" | "connecting" | "open" | "reconnecting" | "offline";

/**
 * Events that change ride status carry the full ride projection (`ride`).
 * Thin, high-frequency events (location, chat, typing) carry only their data.
 */
export type RideEventPayload =
  | { type: "ride.updated"; ride: Ride }
  | { type: "ride.driver.location_updated"; location: LiveLocation; approach?: Ride["approach"]; progress?: Ride["progress"] }
  | { type: "driver.request.received"; offer: RideOffer }
  | { type: "driver.request.expired"; offerId: string }
  | { type: "driver.request.withdrawn"; offerId: string; reason: "taken" | "cancelled" }
  | { type: "driver.availability.changed"; availability: DriverAvailability }
  | { type: "chat.message.created"; message: RideMessage }
  | { type: "chat.message.delivered"; messageId: string }
  | { type: "chat.message.read"; messageId: string }
  | { type: "chat.typing.started" }
  | { type: "chat.typing.stopped" }
  | { type: "ride.sos.acknowledged" };

export interface RideEvent {
  /** Unique per event; duplicates are dropped. */
  id: string;
  rideId: string | null;
  /** Per-subscription sequence number, when the backend provides one. */
  seq: number | null;
  /** The ride version this event produced, when it changes the ride. */
  rideVersion: number | null;
  occurredAt: string;
  payload: RideEventPayload;
}

export type RideEventType = RideEventPayload["type"];
