import type {
  BadgeTier,
  DocumentStatus,
  DocumentType,
  DriverAvailability,
  DriverTrack,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  MembershipStatus,
  NotificationCategory,
  PaymentStatus,
  RidePassengerState,
  RideStatus,
  RideType,
  SOSStatus,
  TrackSwitchStatus,
  UserRole,
  VerificationStatus,
} from "./enums";

/* ---------------------------------------------------------------------------
   Geography
   ------------------------------------------------------------------------ */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RideLocation extends Coordinates {
  id: string;
  /** Short display name, e.g. "Koinonia Centre". */
  label: string;
  /** Full address line shown as secondary text. */
  address: string;
  /** Area/district used for matching copy: "Gwarinpa". */
  area?: string;
}

/** A stewarded meeting point used to keep post-event pickups orderly. */
export interface PickupZone {
  id: string;
  label: string;
  code: string;
  landmark: string;
  walkingMinutes: number;
  recommended?: boolean;
  accessible?: boolean;
  location: RideLocation;
}

export interface RoutePath {
  /** Ordered polyline points from origin to destination. */
  points: Coordinates[];
  distanceKm: number;
  durationMinutes: number;
}

/* ---------------------------------------------------------------------------
   People
   ------------------------------------------------------------------------ */

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  /** Koinonia membership identifier. */
  memberId: string;
  role: UserRole;
  avatarUrl?: string;
  membershipStatus: MembershipStatus;
  joinedAt: string;
}

export interface TrustedContact {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
}

export interface Passenger extends User {
  role: typeof UserRole.PASSENGER;
  rating: number;
  totalRides: number;
  trustedContacts: TrustedContact[];
  homeArea?: string;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  colour: string;
  plateNumber: string;
  year?: number;
  seats: number;
  photoUrl?: string;
  verified: boolean;
}

export interface Driver extends User {
  role: typeof UserRole.DRIVER;
  track: DriverTrack;
  availability: DriverAvailability;
  rating: number;
  totalTrips: number;
  vehicle: Vehicle;
  verificationStatus: VerificationStatus;
  /** Present only when a track switch has been requested. */
  trackSwitch?: TrackSwitchRequest;
  /** Volunteer track only. */
  service?: VolunteerServiceSummary;
  /** Professional track only. Not a wallet — a record of earnings. */
  earningsSummary?: DriverEarningsSummary;
  flagged?: boolean;
  currentLocation?: Coordinates;
  heading?: number;
}

export interface TrackSwitchRequest {
  id: string;
  fromTrack: DriverTrack;
  toTrack: DriverTrack;
  status: TrackSwitchStatus;
  requestedAt: string;
  decidedAt?: string;
  note?: string;
}

/* ---------------------------------------------------------------------------
   Verification
   ------------------------------------------------------------------------ */

export interface VerificationDocument {
  id: string;
  type: DocumentType;
  label: string;
  status: DocumentStatus;
  fileName?: string;
  fileType?: string;
  sizeBytes?: number;
  uploadedAt?: string;
  expiresAt?: string;
  /** Reviewer feedback when status is NEEDS_ATTENTION. */
  note?: string;
}

export interface VerificationStep {
  id: string;
  label: string;
  description: string;
  status: "COMPLETE" | "ACTIVE" | "PENDING" | "BLOCKED";
  completedAt?: string;
}

export interface PhysicalInspection {
  required: boolean;
  scheduled: boolean;
  scheduledAt?: string;
  location?: string;
  note?: string;
}

export interface DriverVerification {
  id: string;
  driverId: string;
  applicantName: string;
  applicantAvatarUrl?: string;
  track: DriverTrack;
  status: VerificationStatus;
  submittedAt?: string;
  updatedAt: string;
  documents: VerificationDocument[];
  steps: VerificationStep[];
  inspection: PhysicalInspection;
  vehicle?: Vehicle;
  /** Human-readable context — never a bare "Pending". */
  statusDetail: string;
  changesRequested?: string[];
  reviewerNote?: string;
}

/* ---------------------------------------------------------------------------
   Rides
   ------------------------------------------------------------------------ */

export interface RidePassenger {
  id: string;
  passengerId: string;
  name: string;
  avatarUrl?: string;
  verified: boolean;
  rating: number;
  seatIndex: 1 | 2 | 3;
  state: RidePassengerState;
  pickup: RideLocation;
  dropoff: RideLocation;
  /** Professional shared rides only. Undefined on volunteer rides. */
  fareShare?: number;
  paymentStatus: PaymentStatus;
}

/**
 * A fare quote as the UI consumes it. Structurally matches the quote the ride
 * service returns, declared here so stores and components can type against it
 * without importing from the service layer.
 */
export interface FareQuoteLike {
  routeFare: number;
  perRider: number;
  riders: number;
  breakdown: { riders: number; each: number }[];
}

export interface RideRequest {
  id: string;
  passengerId: string;
  passengerName: string;
  passengerAvatarUrl?: string;
  passengerRating: number;
  passengerVerified: boolean;
  pickup: RideLocation;
  destination: RideLocation;
  track: DriverTrack;
  rideType: RideType;
  /** Professional only. */
  fare?: number;
  /** Extra minutes added to the driver's existing route. */
  detourMinutes: number;
  requestedAt: string;
  /** Seconds until the request expires, for the countdown ring. */
  expiresInSeconds: number;
}

export interface RideEvent {
  id: string;
  label: string;
  detail?: string;
  at: string;
  kind: "status" | "safety" | "payment" | "rating";
}

export interface Ride {
  id: string;
  reference: string;
  status: RideStatus;
  track: DriverTrack;
  rideType: RideType;
  pickup: RideLocation;
  destination: RideLocation;
  route?: RoutePath;
  driver?: Driver;
  passengers: RidePassenger[];
  requestedAt: string;
  matchedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  etaMinutes?: number;
  distanceKm?: number;
  durationMinutes?: number;
  /** Whole-route fare. Undefined for volunteer rides — never render ₦0. */
  fare?: number;
  payment?: Payment;
  sos?: SOSAlert;
  events: RideEvent[];
  ratingGiven?: Rating;
  shareLink?: string;
  sharingActive?: boolean;
}

/* ---------------------------------------------------------------------------
   Payments — professional track only
   ------------------------------------------------------------------------ */

export interface Payment {
  id: string;
  rideId: string;
  status: PaymentStatus;
  /** Total route fare. */
  routeFare: number;
  /** This user's share (equals routeFare on private rides). */
  userShare: number;
  method?: "CARD" | "TRANSFER" | "CASH";
  processedAt?: string;
  failureReason?: string;
}

export interface Receipt {
  id: string;
  reference: string;
  rideId: string;
  rideReference: string;
  issuedAt: string;
  driverName: string;
  passengerName: string;
  origin: string;
  destination: string;
  rideType: RideType;
  routeFare: number;
  userShare: number;
  paymentStatus: PaymentStatus;
  riders: number;
}

export interface DriverEarning {
  id: string;
  rideId: string;
  rideReference: string;
  date: string;
  destinationLabel: string;
  rideType: RideType;
  amount: number;
  paymentStatus: PaymentStatus;
}

export interface DriverEarningsSummary {
  weekToDate: number;
  weekTrips: number;
  averageRating: number;
  /** Seven-day series for the earnings chart. */
  dailySeries: { label: string; amount: number }[];
  lastPayoutAt?: string;
}

/* ---------------------------------------------------------------------------
   Volunteer recognition
   ------------------------------------------------------------------------ */

export interface VolunteerServiceRecord {
  id: string;
  driverId: string;
  rideId: string;
  rideReference: string;
  date: string;
  destinationLabel: string;
  passengersServed: number;
  hours: number;
}

export interface VolunteerBadge {
  id: string;
  name: string;
  description: string;
  tier: BadgeTier;
  earnedAt?: string;
  progress?: { current: number; target: number };
}

export interface VolunteerServiceSummary {
  serviceHours: number;
  volunteerTrips: number;
  passengersServed: number;
  badges: VolunteerBadge[];
  /** Confirmation state for the next scheduled service. */
  nextEventConfirmed?: boolean;
}

/* ---------------------------------------------------------------------------
   Safety
   ------------------------------------------------------------------------ */

export interface SOSAlert {
  id: string;
  rideId: string;
  rideReference: string;
  status: SOSStatus;
  raisedBy: "PASSENGER" | "DRIVER";
  raisedByName: string;
  raisedAt: string;
  acknowledgedAt?: string;
  respondingAt?: string;
  resolvedAt?: string;
  location?: Coordinates;
  note?: string;
}

export interface Incident {
  id: string;
  reference: string;
  rideId?: string;
  rideReference?: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  openedAt: string;
  updatedAt: string;
  resolvedAt?: string;
  assignedTo?: string;
  participants: { id: string; name: string; role: UserRole }[];
  timeline: RideEvent[];
  adminNotes: { id: string; author: string; note: string; at: string }[];
}

/* ---------------------------------------------------------------------------
   Ratings, notifications, events
   ------------------------------------------------------------------------ */

export interface Rating {
  id: string;
  rideId: string;
  fromUserId: string;
  toUserId: string;
  stars: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  /** SOS notifications override everything else in the drawer. */
  priority?: "NORMAL" | "HIGH" | "CRITICAL";
  href?: string;
}

export interface Event {
  id: string;
  name: string;
  venue: string;
  location: RideLocation;
  startsAt: string;
  endsAt: string;
  expectedAttendance?: number;
}

/* ---------------------------------------------------------------------------
   Admin aggregates
   ------------------------------------------------------------------------ */

export interface AdminMetric {
  id: string;
  label: string;
  value: number;
  /** Formatted display value where the raw number is not the display form. */
  display?: string;
  deltaPercent?: number;
  intent?: "neutral" | "positive" | "attention" | "critical";
  series?: number[];
}

export interface LiveRideSummary {
  id: string;
  reference: string;
  driverName: string;
  driverAvatarUrl?: string;
  track: DriverTrack;
  rideType: RideType;
  passengerCount: number;
  status: RideStatus;
  etaMinutes: number;
  sosActive: boolean;
  position: Coordinates;
  heading: number;
  route?: RoutePath;
}

export interface QualityFlag {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectAvatarUrl?: string;
  role: UserRole;
  track?: DriverTrack;
  averageRating: number;
  lowRatings: number;
  trips: number;
  reason: string;
  flaggedAt: string;
}

export interface ReportSeriesPoint {
  label: string;
  value: number;
  secondary?: number;
}

export interface ReportSection {
  id: string;
  title: string;
  description: string;
  metrics: AdminMetric[];
  series?: ReportSeriesPoint[];
}
