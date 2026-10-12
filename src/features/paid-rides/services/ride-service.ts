import type {
  AcceptOutcome,
  DriverAvailability,
  EmergencyType,
  FareEstimate,
  GeoPoint,
  LiveLocation,
  Place,
  RatingInput,
  Ride,
  RideMessage,
  RideOffer,
  RideSummary,
  SafetyReportCategory,
  Viewer,
} from "../domain/types";

/**
 * The only way Paid Rides screens reach data.
 *
 * Two implementations exist: `ride-api-service.ts` (HTTP against the real
 * backend) and `ride-mock-service.ts` (an isolated in-browser simulation).
 * `services/index.ts` picks one from `NEXT_PUBLIC_PAID_RIDES`. Screens and
 * hooks never import either implementation directly.
 *
 * Every mutation takes an idempotency key so a retried tap, a reconnect or a
 * double submission can never request two rides or accept twice.
 */

export interface MutationOptions {
  idempotencyKey: string;
  signal?: AbortSignal;
}

export interface EstimateInput {
  pickup: Place;
  destination: Place;
}

export interface RequestRideInput {
  estimateId: string;
  optionId: string;
  paymentMethodId: string | null;
  pickup: Place;
  destination: Place;
}

export interface SendMessageInput {
  rideId: string;
  clientId: string;
  body: string;
}

export interface SosInput {
  rideId: string;
  type: EmergencyType;
  location: GeoPoint | null;
}

export interface SafetyReportInput {
  rideId: string;
  category: SafetyReportCategory;
  details?: string;
}

export interface RideHistoryPage {
  items: RideSummary[];
  nextCursor: string | null;
}

export interface PassengerRideService {
  getViewer(signal?: AbortSignal): Promise<Viewer>;
  /** The one live ride for this rider, or null. The source of truth after reload. */
  getCurrentRide(signal?: AbortSignal): Promise<Ride | null>;
  getRide(rideId: string, signal?: AbortSignal): Promise<Ride>;
  estimateRide(input: EstimateInput, signal?: AbortSignal): Promise<FareEstimate>;
  requestRide(input: RequestRideInput, options: MutationOptions): Promise<Ride>;
  /** Retry matching after NO_DRIVERS, optionally with a different option. */
  retrySearch(rideId: string, optionId: string | null, options: MutationOptions): Promise<Ride>;
  cancelRide(rideId: string, reason: string | null, options: MutationOptions): Promise<Ride>;
  rateRide(input: RatingInput, options: MutationOptions): Promise<Ride>;
  getRideHistory(cursor: string | null, signal?: AbortSignal): Promise<RideHistoryPage>;
}

export interface DriverRideService {
  getDriverAvailability(signal?: AbortSignal): Promise<DriverAvailability>;
  setDriverAvailability(online: boolean, options: MutationOptions): Promise<DriverAvailability>;
  getCurrentDriverRide(signal?: AbortSignal): Promise<Ride | null>;
  /** The server answers with the authoritative outcome; never assume success. */
  acceptOffer(offer: RideOffer, options: MutationOptions): Promise<{ outcome: AcceptOutcome; ride?: Ride }>;
  declineOffer(offerId: string, options: MutationOptions): Promise<void>;
  markArrived(rideId: string, options: MutationOptions): Promise<Ride>;
  startRide(rideId: string, pin: string | null, options: MutationOptions): Promise<Ride>;
  completeRide(rideId: string, options: MutationOptions): Promise<Ride>;
  driverCancelRide(rideId: string, reason: string, options: MutationOptions): Promise<Ride>;
  getDriverHistory(cursor: string | null, signal?: AbortSignal): Promise<RideHistoryPage>;
  /** REST fallback for location when the realtime channel is down. */
  updateDriverLocation(location: LiveLocation): Promise<void>;
}

export interface ChatService {
  getMessages(rideId: string, signal?: AbortSignal): Promise<RideMessage[]>;
  sendMessage(input: SendMessageInput, options: MutationOptions): Promise<RideMessage>;
  markRead(rideId: string, lastMessageId: string): Promise<void>;
}

export interface SafetyService {
  triggerSos(input: SosInput, options: MutationOptions): Promise<void>;
  reportSafetyIssue(input: SafetyReportInput, options: MutationOptions): Promise<void>;
  /** Server-issued live trip link; null when sharing isn't available. */
  getShareLink(rideId: string): Promise<string | null>;
}

export interface RideService extends PassengerRideService, DriverRideService, ChatService, SafetyService {
  readonly mode: "mock" | "api";
}
