/**
 * Domain enums. Every status in the product is modelled here — no raw status
 * strings anywhere else in the codebase.
 *
 * These are const objects rather than TS `enum` so they are erasable, tree
 * shakeable and usable as literal union types.
 */

export const UserRole = {
  PASSENGER: "PASSENGER",
  DRIVER: "DRIVER",
  ADMIN: "ADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const DriverTrack = {
  VOLUNTEER: "VOLUNTEER",
  PROFESSIONAL: "PROFESSIONAL",
} as const;
export type DriverTrack = (typeof DriverTrack)[keyof typeof DriverTrack];

export const RideType = {
  PRIVATE: "PRIVATE",
  SHARED: "SHARED",
} as const;
export type RideType = (typeof RideType)[keyof typeof RideType];

/** Canonical ride lifecycle, shared by passenger, driver and admin views. */
export const RideStatus = {
  IDLE: "IDLE",
  REQUESTING: "REQUESTING",
  SEARCHING: "SEARCHING",
  AWAITING_DRIVER: "AWAITING_DRIVER",
  MATCHED: "MATCHED",
  DRIVER_APPROACHING: "DRIVER_APPROACHING",
  DRIVER_ARRIVED: "DRIVER_ARRIVED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  RATING_PENDING: "RATING_PENDING",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
  NO_MATCH: "NO_MATCH",
} as const;
export type RideStatus = (typeof RideStatus)[keyof typeof RideStatus];

export const VerificationStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  DOCUMENT_REVIEW: "DOCUMENT_REVIEW",
  INSPECTION_REQUIRED: "INSPECTION_REQUIRED",
  INSPECTION_SCHEDULED: "INSPECTION_SCHEDULED",
  FINAL_REVIEW: "FINAL_REVIEW",
  APPROVED: "APPROVED",
  CHANGES_REQUIRED: "CHANGES_REQUIRED",
  REJECTED: "REJECTED",
} as const;
export type VerificationStatus =
  (typeof VerificationStatus)[keyof typeof VerificationStatus];

/** Membership (passenger) verification — separate from driver verification. */
export const MembershipStatus = {
  UNVERIFIED: "UNVERIFIED",
  CHECKING: "CHECKING",
  VERIFIED: "VERIFIED",
  ACTION_REQUIRED: "ACTION_REQUIRED",
  REJECTED: "REJECTED",
} as const;
export type MembershipStatus =
  (typeof MembershipStatus)[keyof typeof MembershipStatus];

export const PaymentStatus = {
  /** Volunteer rides. Never renders money. */
  NOT_APPLICABLE: "NOT_APPLICABLE",
  FARE_LOADING: "FARE_LOADING",
  FARE_READY: "FARE_READY",
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PAID: "PAID",
  FAILED: "FAILED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const SOSStatus = {
  INACTIVE: "INACTIVE",
  ACTIVATING: "ACTIVATING",
  SENT: "SENT",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  RESPONDING: "RESPONDING",
  RESOLVED: "RESOLVED",
} as const;
export type SOSStatus = (typeof SOSStatus)[keyof typeof SOSStatus];

export const DriverAvailability = {
  OFFLINE: "OFFLINE",
  AVAILABLE: "AVAILABLE",
  DESTINATION_SET: "DESTINATION_SET",
  WAITING: "WAITING",
  REQUEST_RECEIVED: "REQUEST_RECEIVED",
  ON_TRIP: "ON_TRIP",
} as const;
export type DriverAvailability =
  (typeof DriverAvailability)[keyof typeof DriverAvailability];

export const DriverAccountStatus = {
  ACTIVE: "ACTIVE",
  FLAGGED: "FLAGGED",
  DEACTIVATED: "DEACTIVATED",
} as const;
export type DriverAccountStatus =
  (typeof DriverAccountStatus)[keyof typeof DriverAccountStatus];

export const InspectionStatus = {
  CURRENT: "CURRENT",
  DUE_SOON: "DUE_SOON",
  SCHEDULED: "SCHEDULED",
  OVERDUE: "OVERDUE",
  MISSED: "MISSED",
} as const;
export type InspectionStatus =
  (typeof InspectionStatus)[keyof typeof InspectionStatus];

/** Shared rides are capped at 3 passengers — Product Rule 2. */
export const SharedSeatStatus = {
  EMPTY: "0_OF_3",
  ONE: "1_OF_3",
  TWO: "2_OF_3",
  FULL: "3_OF_3_FULL",
} as const;
export type SharedSeatStatus =
  (typeof SharedSeatStatus)[keyof typeof SharedSeatStatus];

export const MAX_SHARED_PASSENGERS = 3;

export const DocumentType = {
  GOVERNMENT_ID: "GOVERNMENT_ID",
  PROFILE_PHOTO: "PROFILE_PHOTO",
  DRIVERS_LICENCE: "DRIVERS_LICENCE",
  VEHICLE_REGISTRATION: "VEHICLE_REGISTRATION",
  INSURANCE: "INSURANCE",
  ROADWORTHINESS: "ROADWORTHINESS",
  VEHICLE_PHOTO: "VEHICLE_PHOTO",
  GUARANTOR_PHOTO: "GUARANTOR_PHOTO",
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DocumentStatus = {
  MISSING: "MISSING",
  UPLOADING: "UPLOADING",
  UPLOADED: "UPLOADED",
  NEEDS_ATTENTION: "NEEDS_ATTENTION",
  EXPIRED: "EXPIRED",
  VERIFIED: "VERIFIED",
} as const;
export type DocumentStatus =
  (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const IncidentStatus = {
  OPEN: "OPEN",
  UNDER_REVIEW: "UNDER_REVIEW",
  RESOLVED: "RESOLVED",
} as const;
export type IncidentStatus =
  (typeof IncidentStatus)[keyof typeof IncidentStatus];

export const IncidentSeverity = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type IncidentSeverity =
  (typeof IncidentSeverity)[keyof typeof IncidentSeverity];

export const IncidentCategory = {
  SAFETY_CONCERN: "SAFETY_CONCERN",
  SOS_ACTIVATION: "SOS_ACTIVATION",
  DRIVER_CONDUCT: "DRIVER_CONDUCT",
  PASSENGER_CONDUCT: "PASSENGER_CONDUCT",
  VEHICLE_ISSUE: "VEHICLE_ISSUE",
  PAYMENT_DISPUTE: "PAYMENT_DISPUTE",
  OTHER: "OTHER",
} as const;
export type IncidentCategory =
  (typeof IncidentCategory)[keyof typeof IncidentCategory];

export const NotificationCategory = {
  RIDE: "RIDE",
  VERIFICATION: "VERIFICATION",
  PAYMENT: "PAYMENT",
  SAFETY: "SAFETY",
  SERVICE: "SERVICE",
} as const;
export type NotificationCategory =
  (typeof NotificationCategory)[keyof typeof NotificationCategory];

export const TrackSwitchStatus = {
  NONE: "NONE",
  REQUESTED: "REQUESTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  DECLINED: "DECLINED",
} as const;
export type TrackSwitchStatus =
  (typeof TrackSwitchStatus)[keyof typeof TrackSwitchStatus];

export const RidePassengerState = {
  AWAITING_PICKUP: "AWAITING_PICKUP",
  PICKED_UP: "PICKED_UP",
  DROPPED_OFF: "DROPPED_OFF",
  NO_SHOW: "NO_SHOW",
} as const;
export type RidePassengerState =
  (typeof RidePassengerState)[keyof typeof RidePassengerState];

export const BadgeTier = {
  BRONZE: "BRONZE",
  SILVER: "SILVER",
  GOLD: "GOLD",
  PLATINUM: "PLATINUM",
} as const;
export type BadgeTier = (typeof BadgeTier)[keyof typeof BadgeTier];

export const ConnectivityState = {
  ONLINE: "ONLINE",
  RECONNECTING: "RECONNECTING",
  OFFLINE: "OFFLINE",
} as const;
export type ConnectivityState =
  (typeof ConnectivityState)[keyof typeof ConnectivityState];

export const PermissionState = {
  UNKNOWN: "UNKNOWN",
  PROMPT: "PROMPT",
  GRANTED: "GRANTED",
  DENIED: "DENIED",
} as const;
export type PermissionState =
  (typeof PermissionState)[keyof typeof PermissionState];
