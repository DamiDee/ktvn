import {
  DriverAvailability,
  MAX_SHARED_PASSENGERS,
  PaymentStatus,
  RideStatus,
  SharedSeatStatus,
  SOSStatus,
  VerificationStatus,
} from "@/types/enums";

/**
 * Explicit state machines. Transitions are declared here, once, so no
 * component invents its own rules with scattered booleans.
 */

type TransitionMap<T extends string> = Readonly<Record<T, readonly T[]>>;

/* ---------------------------------------------------------------------------
   Ride lifecycle
   ------------------------------------------------------------------------ */

export const RIDE_TRANSITIONS: TransitionMap<RideStatus> = {
  [RideStatus.IDLE]: [RideStatus.REQUESTING],
  [RideStatus.REQUESTING]: [RideStatus.SEARCHING, RideStatus.CANCELLED],
  [RideStatus.SEARCHING]: [
    RideStatus.AWAITING_DRIVER,
    RideStatus.MATCHED,
    RideStatus.NO_MATCH,
    RideStatus.CANCELLED,
  ],
  [RideStatus.AWAITING_DRIVER]: [
    RideStatus.MATCHED,
    RideStatus.NO_MATCH,
    RideStatus.CANCELLED,
  ],
  [RideStatus.MATCHED]: [RideStatus.DRIVER_APPROACHING, RideStatus.CANCELLED],
  [RideStatus.DRIVER_APPROACHING]: [
    RideStatus.DRIVER_ARRIVED,
    RideStatus.CANCELLED,
  ],
  [RideStatus.DRIVER_ARRIVED]: [RideStatus.IN_PROGRESS, RideStatus.CANCELLED],
  // A journey can be ended early: the passenger asks to stop, or the driver
  // has to. It lands in CANCELLED like any other unfinished ride.
  [RideStatus.IN_PROGRESS]: [RideStatus.COMPLETED, RideStatus.CANCELLED],
  [RideStatus.COMPLETED]: [RideStatus.PAYMENT_PENDING, RideStatus.RATING_PENDING],
  [RideStatus.PAYMENT_PENDING]: [RideStatus.RATING_PENDING, RideStatus.CLOSED],
  [RideStatus.RATING_PENDING]: [RideStatus.CLOSED],
  [RideStatus.CLOSED]: [],
  [RideStatus.CANCELLED]: [],
  [RideStatus.NO_MATCH]: [RideStatus.SEARCHING, RideStatus.IDLE],
};

export function canTransitionRide(from: RideStatus, to: RideStatus): boolean {
  return RIDE_TRANSITIONS[from].includes(to);
}

/** Statuses where a live map and trip controls should be on screen. */
const ACTIVE_RIDE_STATUSES = new Set<RideStatus>([
  RideStatus.MATCHED,
  RideStatus.DRIVER_APPROACHING,
  RideStatus.DRIVER_ARRIVED,
  RideStatus.IN_PROGRESS,
]);

export function isRideActive(status: RideStatus): boolean {
  return ACTIVE_RIDE_STATUSES.has(status);
}

/** SOS must be reachable throughout an active trip — Product Rule 5. */
export function isSosAvailable(status: RideStatus): boolean {
  return isRideActive(status);
}

const SEARCHING_STATUSES = new Set<RideStatus>([
  RideStatus.REQUESTING,
  RideStatus.SEARCHING,
  RideStatus.AWAITING_DRIVER,
]);

export function isRideSearching(status: RideStatus): boolean {
  return SEARCHING_STATUSES.has(status);
}

const TERMINAL_STATUSES = new Set<RideStatus>([
  RideStatus.COMPLETED,
  RideStatus.CLOSED,
  RideStatus.CANCELLED,
]);

export function isRideTerminal(status: RideStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Cancelling is only offered before the trip actually starts. */
export function canCancelRide(status: RideStatus): boolean {
  return (
    isRideSearching(status) ||
    status === RideStatus.MATCHED ||
    status === RideStatus.DRIVER_APPROACHING ||
    status === RideStatus.DRIVER_ARRIVED ||
    status === RideStatus.IN_PROGRESS
  );
}

/** Ordered progress used by timelines and the ride progress indicator. */
export const RIDE_PROGRESS_ORDER: readonly RideStatus[] = [
  RideStatus.SEARCHING,
  RideStatus.MATCHED,
  RideStatus.DRIVER_APPROACHING,
  RideStatus.DRIVER_ARRIVED,
  RideStatus.IN_PROGRESS,
  RideStatus.COMPLETED,
];

export function rideProgressIndex(status: RideStatus): number {
  const index = RIDE_PROGRESS_ORDER.indexOf(status);
  if (index >= 0) return index;
  if (isRideTerminal(status)) return RIDE_PROGRESS_ORDER.length - 1;
  return 0;
}

/* ---------------------------------------------------------------------------
   Driver availability
   ------------------------------------------------------------------------ */

export const DRIVER_TRANSITIONS: TransitionMap<DriverAvailability> = {
  [DriverAvailability.OFFLINE]: [DriverAvailability.AVAILABLE],
  [DriverAvailability.AVAILABLE]: [
    DriverAvailability.DESTINATION_SET,
    DriverAvailability.OFFLINE,
  ],
  [DriverAvailability.DESTINATION_SET]: [
    DriverAvailability.WAITING,
    DriverAvailability.AVAILABLE,
    DriverAvailability.OFFLINE,
  ],
  [DriverAvailability.WAITING]: [
    DriverAvailability.REQUEST_RECEIVED,
    DriverAvailability.DESTINATION_SET,
    DriverAvailability.OFFLINE,
  ],
  [DriverAvailability.REQUEST_RECEIVED]: [
    DriverAvailability.ON_TRIP,
    DriverAvailability.WAITING,
  ],
  [DriverAvailability.ON_TRIP]: [
    DriverAvailability.WAITING,
    DriverAvailability.AVAILABLE,
    DriverAvailability.OFFLINE,
  ],
};

export function canTransitionDriver(
  from: DriverAvailability,
  to: DriverAvailability,
): boolean {
  return DRIVER_TRANSITIONS[from].includes(to);
}

export function isDriverOnline(availability: DriverAvailability): boolean {
  return availability !== DriverAvailability.OFFLINE;
}

/** Going offline mid-availability is destructive and needs confirmation. */
export function goingOfflineNeedsConfirmation(
  availability: DriverAvailability,
): boolean {
  return (
    availability === DriverAvailability.WAITING ||
    availability === DriverAvailability.DESTINATION_SET ||
    availability === DriverAvailability.ON_TRIP
  );
}

/* ---------------------------------------------------------------------------
   Verification
   ------------------------------------------------------------------------ */

export const VERIFICATION_TRANSITIONS: TransitionMap<VerificationStatus> = {
  [VerificationStatus.DRAFT]: [VerificationStatus.SUBMITTED],
  [VerificationStatus.SUBMITTED]: [VerificationStatus.DOCUMENT_REVIEW],
  [VerificationStatus.DOCUMENT_REVIEW]: [
    VerificationStatus.INSPECTION_REQUIRED,
    VerificationStatus.CHANGES_REQUIRED,
    VerificationStatus.REJECTED,
  ],
  [VerificationStatus.INSPECTION_REQUIRED]: [
    VerificationStatus.INSPECTION_SCHEDULED,
    VerificationStatus.CHANGES_REQUIRED,
  ],
  [VerificationStatus.INSPECTION_SCHEDULED]: [
    VerificationStatus.FINAL_REVIEW,
    VerificationStatus.CHANGES_REQUIRED,
  ],
  [VerificationStatus.FINAL_REVIEW]: [
    VerificationStatus.APPROVED,
    VerificationStatus.CHANGES_REQUIRED,
    VerificationStatus.REJECTED,
  ],
  [VerificationStatus.CHANGES_REQUIRED]: [VerificationStatus.SUBMITTED],
  [VerificationStatus.APPROVED]: [],
  [VerificationStatus.REJECTED]: [],
};

/** Both tracks pass the same standard — Product Rule 10. */
export const VERIFICATION_ORDER: readonly VerificationStatus[] = [
  VerificationStatus.SUBMITTED,
  VerificationStatus.DOCUMENT_REVIEW,
  VerificationStatus.INSPECTION_REQUIRED,
  VerificationStatus.FINAL_REVIEW,
  VerificationStatus.APPROVED,
];

export function verificationProgress(status: VerificationStatus): number {
  if (status === VerificationStatus.DRAFT) return 0;
  if (status === VerificationStatus.REJECTED) return 0;
  if (status === VerificationStatus.CHANGES_REQUIRED) return 0.4;
  if (status === VerificationStatus.INSPECTION_SCHEDULED) return 0.62;
  const index = VERIFICATION_ORDER.indexOf(status);
  if (index < 0) return 0;
  return (index + 1) / VERIFICATION_ORDER.length;
}

export function isVerificationComplete(status: VerificationStatus): boolean {
  return status === VerificationStatus.APPROVED;
}

export function verificationNeedsApplicantAction(
  status: VerificationStatus,
): boolean {
  return (
    status === VerificationStatus.CHANGES_REQUIRED ||
    status === VerificationStatus.DRAFT
  );
}

/* ---------------------------------------------------------------------------
   Payment
   ------------------------------------------------------------------------ */

export const PAYMENT_TRANSITIONS: TransitionMap<PaymentStatus> = {
  [PaymentStatus.NOT_APPLICABLE]: [],
  [PaymentStatus.FARE_LOADING]: [PaymentStatus.FARE_READY],
  [PaymentStatus.FARE_READY]: [PaymentStatus.PENDING],
  [PaymentStatus.PENDING]: [PaymentStatus.PROCESSING],
  [PaymentStatus.PROCESSING]: [PaymentStatus.PAID, PaymentStatus.FAILED],
  [PaymentStatus.PAID]: [],
  [PaymentStatus.FAILED]: [PaymentStatus.PENDING],
};

export function isPaymentSettled(status: PaymentStatus): boolean {
  return status === PaymentStatus.PAID || status === PaymentStatus.NOT_APPLICABLE;
}

export function canRetryPayment(status: PaymentStatus): boolean {
  return status === PaymentStatus.FAILED;
}

/* ---------------------------------------------------------------------------
   SOS
   ------------------------------------------------------------------------ */

export const SOS_TRANSITIONS: TransitionMap<SOSStatus> = {
  [SOSStatus.INACTIVE]: [SOSStatus.ACTIVATING],
  [SOSStatus.ACTIVATING]: [SOSStatus.SENT, SOSStatus.INACTIVE],
  [SOSStatus.SENT]: [SOSStatus.ACKNOWLEDGED],
  [SOSStatus.ACKNOWLEDGED]: [SOSStatus.RESPONDING],
  [SOSStatus.RESPONDING]: [SOSStatus.RESOLVED],
  [SOSStatus.RESOLVED]: [],
};

export function canTransitionSos(from: SOSStatus, to: SOSStatus): boolean {
  return SOS_TRANSITIONS[from].includes(to);
}

export function isSosRaised(status: SOSStatus): boolean {
  return status !== SOSStatus.INACTIVE && status !== SOSStatus.ACTIVATING;
}

export function isSosLive(status: SOSStatus): boolean {
  return isSosRaised(status) && status !== SOSStatus.RESOLVED;
}

/* ---------------------------------------------------------------------------
   Shared seats — hard cap of 3, Product Rule 2
   ------------------------------------------------------------------------ */

const SEAT_STATUS_BY_COUNT: Record<number, SharedSeatStatus> = {
  0: SharedSeatStatus.EMPTY,
  1: SharedSeatStatus.ONE,
  2: SharedSeatStatus.TWO,
  3: SharedSeatStatus.FULL,
};

export function seatStatusFromCount(count: number): SharedSeatStatus {
  const clamped = Math.max(0, Math.min(MAX_SHARED_PASSENGERS, count));
  return SEAT_STATUS_BY_COUNT[clamped];
}

export function seatsRemaining(count: number): number {
  return Math.max(0, MAX_SHARED_PASSENGERS - count);
}

export function isSharedRideFull(count: number): boolean {
  return count >= MAX_SHARED_PASSENGERS;
}

export function canAcceptPassenger(currentCount: number): boolean {
  return currentCount < MAX_SHARED_PASSENGERS;
}
