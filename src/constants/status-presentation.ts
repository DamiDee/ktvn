import {
  DocumentStatus,
  DriverAvailability,
  DriverTrack,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  MembershipStatus,
  PaymentStatus,
  RideStatus,
  RideType,
  SOSStatus,
  TrackSwitchStatus,
  VerificationStatus,
} from "@/types/enums";

/**
 * Single source of truth for how a status is spoken and coloured.
 * Components read from here — they never hardcode status labels or colours.
 *
 * Every entry pairs colour with a label so we never rely on colour alone
 * to convey payment, verification, SOS or ride state (accessibility).
 */

export type StatusTone =
  | "neutral"
  | "info"
  | "active"
  | "pending"
  | "success"
  | "danger"
  | "sos"
  | "professional";

export interface StatusPresentation {
  label: string;
  /** Longer, human phrasing — never a bare "Pending". */
  detail?: string;
  tone: StatusTone;
}

export const TONE_CLASSES: Record<StatusTone, string> = {
  neutral:
    "bg-[color-mix(in_srgb,var(--kx-text)_7%,transparent)] text-ink-secondary ring-1 ring-inset ring-line",
  info: "bg-lilac-50 text-lilac-700 ring-1 ring-inset ring-lilac-200 dark:bg-lilac-900/25 dark:text-lilac-200 dark:ring-lilac-700/40",
  active:
    "bg-forest-50 text-forest-700 ring-1 ring-inset ring-forest-200 dark:bg-forest-500/15 dark:text-forest-200 dark:ring-forest-500/30",
  pending:
    "bg-pending-50 text-pending-700 ring-1 ring-inset ring-gold-200 dark:bg-gold-500/15 dark:text-gold-200 dark:ring-gold-600/35",
  success:
    "bg-success-50 text-success-700 ring-1 ring-inset ring-success-500/25 dark:bg-success-500/15 dark:text-emerald-200 dark:ring-success-500/30",
  danger:
    "bg-danger-50 text-danger-700 ring-1 ring-inset ring-danger-500/25 dark:bg-danger-500/15 dark:text-red-200 dark:ring-danger-500/30",
  sos: "bg-sos-50 text-sos-700 ring-1 ring-inset ring-sos-500/30 dark:bg-sos-500/20 dark:text-red-100 dark:ring-sos-500/45",
  professional:
    "bg-lilac-50 text-lilac-700 ring-1 ring-inset ring-lilac-200 dark:bg-lilac-900/30 dark:text-lilac-200 dark:ring-lilac-700/45",
};

/** Solid dot colours for status indicators. */
export const TONE_DOT: Record<StatusTone, string> = {
  neutral: "bg-ink-muted",
  info: "bg-lilac-500",
  active: "bg-success-500",
  pending: "bg-gold-500",
  success: "bg-success-500",
  danger: "bg-danger-500",
  sos: "bg-sos-500",
  professional: "bg-lilac-600",
};

/* --- Ride ---------------------------------------------------------------- */

export const RIDE_STATUS_PRESENTATION: Record<RideStatus, StatusPresentation> = {
  [RideStatus.IDLE]: { label: "Not started", tone: "neutral" },
  [RideStatus.REQUESTING]: {
    label: "Sending request",
    detail: "Preparing your journey",
    tone: "info",
  },
  [RideStatus.SEARCHING]: {
    label: "Finding a driver",
    detail: "Finding verified drivers nearby",
    tone: "info",
  },
  [RideStatus.AWAITING_DRIVER]: {
    label: "Awaiting response",
    detail: "A verified driver is reviewing your request",
    tone: "info",
  },
  [RideStatus.MATCHED]: {
    label: "Driver matched",
    detail: "Your driver is confirmed",
    tone: "active",
  },
  [RideStatus.DRIVER_APPROACHING]: {
    label: "Driver approaching",
    detail: "Your driver is on the way",
    tone: "active",
  },
  [RideStatus.DRIVER_ARRIVED]: {
    label: "Driver arrived",
    detail: "Your driver is at the pickup point",
    tone: "active",
  },
  [RideStatus.IN_PROGRESS]: {
    label: "On the way",
    detail: "Journey in progress",
    tone: "active",
  },
  [RideStatus.COMPLETED]: {
    label: "Completed",
    detail: "You've arrived",
    tone: "success",
  },
  [RideStatus.PAYMENT_PENDING]: {
    label: "Payment pending",
    detail: "Complete payment to close this ride",
    tone: "pending",
  },
  [RideStatus.RATING_PENDING]: {
    label: "Rating pending",
    detail: "Share how the journey went",
    tone: "pending",
  },
  [RideStatus.CLOSED]: { label: "Closed", tone: "neutral" },
  [RideStatus.CANCELLED]: { label: "Cancelled", tone: "danger" },
  [RideStatus.NO_MATCH]: {
    label: "No match",
    detail: "No matching driver is available right now",
    tone: "neutral",
  },
};

export const RIDE_TYPE_LABEL: Record<RideType, string> = {
  [RideType.PRIVATE]: "Private",
  [RideType.SHARED]: "Shared",
};

export const TRACK_LABEL: Record<DriverTrack, string> = {
  [DriverTrack.VOLUNTEER]: "Volunteer",
  [DriverTrack.PROFESSIONAL]: "Professional",
};

export const TRACK_TONE: Record<DriverTrack, StatusTone> = {
  [DriverTrack.VOLUNTEER]: "pending",
  [DriverTrack.PROFESSIONAL]: "professional",
};

export const TRACK_DESCRIPTION: Record<DriverTrack, string> = {
  [DriverTrack.VOLUNTEER]: "Free. Given in service.",
  [DriverTrack.PROFESSIONAL]: "Paid. Transparent and predictable.",
};

/* --- Driver availability ------------------------------------------------- */

export const DRIVER_AVAILABILITY_PRESENTATION: Record<
  DriverAvailability,
  StatusPresentation
> = {
  [DriverAvailability.OFFLINE]: { label: "Offline", tone: "neutral" },
  [DriverAvailability.AVAILABLE]: {
    label: "Available",
    detail: "You're online and visible to passengers",
    tone: "active",
  },
  [DriverAvailability.DESTINATION_SET]: {
    label: "Destination set",
    detail: "Ready to accept requests along your route",
    tone: "active",
  },
  [DriverAvailability.WAITING]: {
    label: "Waiting",
    detail: "Waiting for passengers heading your direction",
    tone: "active",
  },
  [DriverAvailability.REQUEST_RECEIVED]: {
    label: "Request received",
    detail: "A passenger is waiting on your response",
    tone: "pending",
  },
  [DriverAvailability.ON_TRIP]: {
    label: "On trip",
    detail: "Journey in progress",
    tone: "active",
  },
};

/* --- Verification -------------------------------------------------------- */

export const VERIFICATION_PRESENTATION: Record<
  VerificationStatus,
  StatusPresentation
> = {
  [VerificationStatus.DRAFT]: {
    label: "Draft",
    detail: "Your application hasn't been submitted yet",
    tone: "neutral",
  },
  [VerificationStatus.SUBMITTED]: {
    label: "Submitted",
    detail: "Your application has been received",
    tone: "info",
  },
  [VerificationStatus.DOCUMENT_REVIEW]: {
    label: "Document review",
    detail: "Your driver's licence and documents are being reviewed",
    tone: "info",
  },
  [VerificationStatus.INSPECTION_REQUIRED]: {
    label: "Inspection required",
    detail: "Physical vehicle inspection is required",
    tone: "pending",
  },
  [VerificationStatus.INSPECTION_SCHEDULED]: {
    label: "Inspection scheduled",
    detail: "Your vehicle inspection has been scheduled",
    tone: "pending",
  },
  [VerificationStatus.FINAL_REVIEW]: {
    label: "Final review",
    detail: "The verification team is completing final checks",
    tone: "info",
  },
  [VerificationStatus.APPROVED]: {
    label: "Approved",
    detail: "You're a verified driver",
    tone: "success",
  },
  [VerificationStatus.CHANGES_REQUIRED]: {
    label: "Changes required",
    detail: "Some details need your attention before we can continue",
    tone: "pending",
  },
  [VerificationStatus.REJECTED]: {
    label: "Not approved",
    detail: "This application was not approved",
    tone: "danger",
  },
};

export const MEMBERSHIP_PRESENTATION: Record<
  MembershipStatus,
  StatusPresentation
> = {
  [MembershipStatus.UNVERIFIED]: {
    label: "Unverified",
    detail: "Confirm your membership to request rides",
    tone: "neutral",
  },
  [MembershipStatus.CHECKING]: {
    label: "Checking",
    detail: "We're confirming your membership record",
    tone: "info",
  },
  [MembershipStatus.VERIFIED]: {
    label: "Verified member",
    detail: "Membership confirmed",
    tone: "success",
  },
  [MembershipStatus.ACTION_REQUIRED]: {
    label: "Action required",
    detail: "We need a little more information to confirm your membership",
    tone: "pending",
  },
  [MembershipStatus.REJECTED]: {
    label: "Not confirmed",
    detail: "We couldn't match this membership identifier",
    tone: "danger",
  },
};

export const DOCUMENT_STATUS_PRESENTATION: Record<
  DocumentStatus,
  StatusPresentation
> = {
  [DocumentStatus.MISSING]: { label: "Missing", tone: "neutral" },
  [DocumentStatus.UPLOADING]: { label: "Uploading", tone: "info" },
  [DocumentStatus.UPLOADED]: { label: "Uploaded", tone: "info" },
  [DocumentStatus.NEEDS_ATTENTION]: {
    label: "Needs attention",
    tone: "pending",
  },
  [DocumentStatus.EXPIRED]: { label: "Expired", tone: "danger" },
  [DocumentStatus.VERIFIED]: { label: "Verified", tone: "success" },
};

/* --- Payment ------------------------------------------------------------- */

export const PAYMENT_PRESENTATION: Record<PaymentStatus, StatusPresentation> = {
  [PaymentStatus.NOT_APPLICABLE]: {
    label: "No payment required",
    detail: "Volunteer ride · No payment required",
    tone: "active",
  },
  [PaymentStatus.FARE_LOADING]: { label: "Calculating fare", tone: "neutral" },
  [PaymentStatus.FARE_READY]: { label: "Fare ready", tone: "info" },
  [PaymentStatus.PENDING]: {
    label: "Pending",
    detail: "Awaiting payment",
    tone: "pending",
  },
  [PaymentStatus.PROCESSING]: {
    label: "Processing",
    detail: "Confirming your payment",
    tone: "info",
  },
  [PaymentStatus.PAID]: { label: "Paid", detail: "Payment confirmed", tone: "success" },
  [PaymentStatus.FAILED]: {
    label: "Failed",
    detail: "That payment didn't go through",
    tone: "danger",
  },
};

/* --- Safety -------------------------------------------------------------- */

export const SOS_PRESENTATION: Record<SOSStatus, StatusPresentation> = {
  [SOSStatus.INACTIVE]: { label: "Inactive", tone: "neutral" },
  [SOSStatus.ACTIVATING]: {
    label: "Activating",
    detail: "Hold to send an emergency alert",
    tone: "sos",
  },
  [SOSStatus.SENT]: {
    label: "Alert sent",
    detail: "Your location has been shared with the safety team",
    tone: "sos",
  },
  [SOSStatus.ACKNOWLEDGED]: {
    label: "Acknowledged",
    detail: "The safety team has seen your alert",
    tone: "sos",
  },
  [SOSStatus.RESPONDING]: {
    label: "Safety team responding",
    detail: "The safety team is responding",
    tone: "sos",
  },
  [SOSStatus.RESOLVED]: {
    label: "Resolved",
    detail: "This alert has been closed",
    tone: "success",
  },
};

export const INCIDENT_STATUS_PRESENTATION: Record<
  IncidentStatus,
  StatusPresentation
> = {
  [IncidentStatus.OPEN]: { label: "Open", tone: "danger" },
  [IncidentStatus.UNDER_REVIEW]: { label: "Under review", tone: "pending" },
  [IncidentStatus.RESOLVED]: { label: "Resolved", tone: "success" },
};

export const INCIDENT_SEVERITY_PRESENTATION: Record<
  IncidentSeverity,
  StatusPresentation
> = {
  [IncidentSeverity.LOW]: { label: "Low", tone: "neutral" },
  [IncidentSeverity.MEDIUM]: { label: "Medium", tone: "info" },
  [IncidentSeverity.HIGH]: { label: "High", tone: "pending" },
  [IncidentSeverity.CRITICAL]: { label: "Critical", tone: "sos" },
};

export const INCIDENT_CATEGORY_LABEL: Record<IncidentCategory, string> = {
  [IncidentCategory.SAFETY_CONCERN]: "Safety concern",
  [IncidentCategory.SOS_ACTIVATION]: "SOS activation",
  [IncidentCategory.DRIVER_CONDUCT]: "Driver conduct",
  [IncidentCategory.PASSENGER_CONDUCT]: "Passenger conduct",
  [IncidentCategory.VEHICLE_ISSUE]: "Vehicle issue",
  [IncidentCategory.PAYMENT_DISPUTE]: "Payment dispute",
  [IncidentCategory.OTHER]: "Other",
};

export const TRACK_SWITCH_PRESENTATION: Record<
  TrackSwitchStatus,
  StatusPresentation
> = {
  [TrackSwitchStatus.NONE]: { label: "No request", tone: "neutral" },
  [TrackSwitchStatus.REQUESTED]: {
    label: "Awaiting approval",
    detail: "Your track switch request is with the verification team",
    tone: "pending",
  },
  [TrackSwitchStatus.UNDER_REVIEW]: {
    label: "Under review",
    detail: "The verification team is reviewing your request",
    tone: "info",
  },
  [TrackSwitchStatus.APPROVED]: { label: "Approved", tone: "success" },
  [TrackSwitchStatus.DECLINED]: { label: "Declined", tone: "danger" },
};
