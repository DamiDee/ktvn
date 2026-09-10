import { buildRoute } from "@/lib/geo";
import {
  DriverTrack,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  RideStatus,
  RideType,
  SOSStatus,
  UserRole,
} from "@/types/enums";
import type {
  AdminMetric,
  Incident,
  LiveRideSummary,
  QualityFlag,
  ReportSection,
  SOSAlert,
} from "@/types/models";
import { LOCATIONS } from "./locations";
import { DRIVERS, PASSENGERS } from "./people";

export const ADMIN_METRICS: AdminMetric[] = [
  {
    id: "m-active-drivers",
    label: "Active drivers",
    value: 128,
    deltaPercent: 6.4,
    intent: "positive",
    series: [96, 102, 108, 104, 116, 121, 128],
  },
  {
    id: "m-live-rides",
    label: "Live rides",
    value: 14,
    deltaPercent: 12.1,
    intent: "neutral",
    series: [8, 11, 9, 13, 10, 12, 14],
  },
  {
    id: "m-pending-verification",
    label: "Pending verification",
    value: 6,
    deltaPercent: -18.2,
    intent: "attention",
    series: [11, 10, 9, 9, 8, 7, 6],
  },
  {
    id: "m-open-incidents",
    label: "Open incidents",
    value: 1,
    deltaPercent: 0,
    intent: "critical",
    series: [2, 1, 3, 1, 1, 2, 1],
  },
];

export const ADMIN_SECONDARY_METRICS: AdminMetric[] = [
  {
    id: "m-completion",
    label: "Completion rate",
    value: 96.4,
    display: "96.4%",
    deltaPercent: 1.2,
    intent: "positive",
  },
  {
    id: "m-match-rate",
    label: "Match rate",
    value: 91.8,
    display: "91.8%",
    deltaPercent: 2.6,
    intent: "positive",
  },
  {
    id: "m-avg-rating",
    label: "Average rating",
    value: 4.83,
    display: "4.83",
    deltaPercent: 0.4,
    intent: "positive",
  },
  {
    id: "m-ride-volume",
    label: "Rides this week",
    value: 1284,
    display: "1,284",
    deltaPercent: 9.1,
    intent: "positive",
  },
];

export const TRACK_DISTRIBUTION = [
  { label: "Volunteer", value: 62, tone: "gold" as const },
  { label: "Professional", value: 38, tone: "lilac" as const },
];

export const RIDE_VOLUME_SERIES = [
  { label: "Mon", value: 148, secondary: 92 },
  { label: "Tue", value: 176, secondary: 108 },
  { label: "Wed", value: 264, secondary: 171 },
  { label: "Thu", value: 189, secondary: 114 },
  { label: "Fri", value: 212, secondary: 129 },
  { label: "Sat", value: 158, secondary: 96 },
  { label: "Sun", value: 337, secondary: 224 },
];

/* --- Live rides ---------------------------------------------------------- */

export const LIVE_RIDES: LiveRideSummary[] = [
  {
    id: "ride-2291",
    reference: "#2291",
    driverName: DRIVERS[1].fullName,
    driverAvatarUrl: DRIVERS[1].avatarUrl,
    track: DriverTrack.VOLUNTEER,
    rideType: RideType.SHARED,
    passengerCount: 2,
    status: RideStatus.IN_PROGRESS,
    etaMinutes: 12,
    sosActive: true,
    position: { lat: 9.0402, lng: 7.3932 },
    heading: 24,
    route: buildRoute(LOCATIONS.koinoniaCentre, LOCATIONS.gwarinpa, {
      seed: "live-2291",
    }),
  },
  {
    id: "ride-2292",
    reference: "#2292",
    driverName: DRIVERS[0].fullName,
    driverAvatarUrl: DRIVERS[0].avatarUrl,
    track: DriverTrack.PROFESSIONAL,
    rideType: RideType.PRIVATE,
    passengerCount: 1,
    status: RideStatus.DRIVER_APPROACHING,
    etaMinutes: 4,
    sosActive: false,
    position: { lat: 9.0021, lng: 7.3888 },
    heading: 61,
    route: buildRoute(LOCATIONS.koinoniaCentre, LOCATIONS.wuseII, {
      seed: "live-2292",
    }),
  },
  {
    id: "ride-2293",
    reference: "#2293",
    driverName: DRIVERS[3].fullName,
    driverAvatarUrl: DRIVERS[3].avatarUrl,
    track: DriverTrack.PROFESSIONAL,
    rideType: RideType.SHARED,
    passengerCount: 3,
    status: RideStatus.IN_PROGRESS,
    etaMinutes: 18,
    sosActive: false,
    position: { lat: 9.0512, lng: 7.4402 },
    heading: 291,
    route: buildRoute(LOCATIONS.koinoniaCentre, LOCATIONS.garki, {
      seed: "live-2293",
    }),
  },
  {
    id: "ride-2294",
    reference: "#2294",
    driverName: DRIVERS[2].fullName,
    driverAvatarUrl: DRIVERS[2].avatarUrl,
    track: DriverTrack.VOLUNTEER,
    rideType: RideType.SHARED,
    passengerCount: 1,
    status: RideStatus.SEARCHING,
    etaMinutes: 0,
    sosActive: false,
    position: { lat: 8.9968, lng: 7.3801 },
    heading: 5,
  },
  {
    id: "ride-2295",
    reference: "#2295",
    driverName: DRIVERS[4].fullName,
    driverAvatarUrl: DRIVERS[4].avatarUrl,
    track: DriverTrack.VOLUNTEER,
    rideType: RideType.PRIVATE,
    passengerCount: 1,
    status: RideStatus.DRIVER_ARRIVED,
    etaMinutes: 0,
    sosActive: false,
    position: { lat: 9.0662, lng: 7.4288 },
    heading: 176,
    route: buildRoute(LOCATIONS.jabi, LOCATIONS.kubwa, { seed: "live-2295" }),
  },
];

export const ACTIVE_SOS: SOSAlert = {
  id: "sos-441",
  rideId: "ride-2291",
  rideReference: "#2291",
  status: SOSStatus.RESPONDING,
  raisedBy: "PASSENGER",
  raisedByName: PASSENGERS[0].fullName,
  raisedAt: "2026-09-09T19:28:00.000Z",
  acknowledgedAt: "2026-09-09T19:28:40.000Z",
  respondingAt: "2026-09-09T19:29:10.000Z",
  location: { lat: 9.0402, lng: 7.3932 },
};

/* --- Incidents ----------------------------------------------------------- */

export const INCIDENTS: Incident[] = [
  {
    id: "inc-1023",
    reference: "#1023",
    rideId: "ride-2291",
    rideReference: "#2291",
    category: IncidentCategory.SOS_ACTIVATION,
    severity: IncidentSeverity.CRITICAL,
    status: IncidentStatus.OPEN,
    title: "SOS activated during active trip",
    description:
      "Passenger activated SOS eight minutes into the journey. Live location is being shared with the safety team.",
    openedAt: "2026-09-09T19:28:00.000Z",
    updatedAt: "2026-09-09T19:29:10.000Z",
    assignedTo: "Deborah Ajayi",
    participants: [
      { id: PASSENGERS[0].id, name: PASSENGERS[0].fullName, role: UserRole.PASSENGER },
      { id: DRIVERS[1].id, name: DRIVERS[1].fullName, role: UserRole.DRIVER },
    ],
    timeline: [
      { id: "t1", label: "SOS activated", detail: "By Grace Adeyemi", at: "2026-09-09T19:28:00.000Z", kind: "safety" },
      { id: "t2", label: "Alert acknowledged", detail: "Safety desk", at: "2026-09-09T19:28:40.000Z", kind: "safety" },
      { id: "t3", label: "Safety team responding", at: "2026-09-09T19:29:10.000Z", kind: "safety" },
    ],
    adminNotes: [
      {
        id: "n1",
        author: "Deborah Ajayi",
        note: "Called the passenger. Line is open, ride continuing under monitoring.",
        at: "2026-09-09T19:31:00.000Z",
      },
    ],
  },
  {
    id: "inc-1019",
    reference: "#1019",
    rideId: "ride-2274",
    rideReference: "#2274",
    category: IncidentCategory.DRIVER_CONDUCT,
    severity: IncidentSeverity.MEDIUM,
    status: IncidentStatus.UNDER_REVIEW,
    title: "Route deviation reported",
    description:
      "Passenger reported an unexplained deviation from the expected route near Life Camp.",
    openedAt: "2026-09-07T21:14:00.000Z",
    updatedAt: "2026-09-08T09:02:00.000Z",
    assignedTo: "Safety desk",
    participants: [
      { id: PASSENGERS[1].id, name: PASSENGERS[1].fullName, role: UserRole.PASSENGER },
      { id: DRIVERS[5].id, name: DRIVERS[5].fullName, role: UserRole.DRIVER },
    ],
    timeline: [
      { id: "t1", label: "Incident opened", at: "2026-09-07T21:14:00.000Z", kind: "safety" },
      { id: "t2", label: "Assigned to safety desk", at: "2026-09-08T09:02:00.000Z", kind: "safety" },
    ],
    adminNotes: [],
  },
  {
    id: "inc-1014",
    reference: "#1014",
    rideId: "ride-2261",
    rideReference: "#2261",
    category: IncidentCategory.PAYMENT_DISPUTE,
    severity: IncidentSeverity.LOW,
    status: IncidentStatus.RESOLVED,
    title: "Shared fare split queried",
    description:
      "Passenger queried the shared fare split after a third rider left early.",
    openedAt: "2026-09-01T18:40:00.000Z",
    updatedAt: "2026-09-02T11:00:00.000Z",
    resolvedAt: "2026-09-02T11:00:00.000Z",
    participants: [
      { id: PASSENGERS[2].id, name: PASSENGERS[2].fullName, role: UserRole.PASSENGER },
    ],
    timeline: [
      { id: "t1", label: "Incident opened", at: "2026-09-01T18:40:00.000Z", kind: "payment" },
      { id: "t2", label: "Resolved", detail: "Fare split explained and confirmed", at: "2026-09-02T11:00:00.000Z", kind: "payment" },
    ],
    adminNotes: [
      {
        id: "n1",
        author: "Deborah Ajayi",
        note: "Split was correct for two riders at the time of completion.",
        at: "2026-09-02T10:55:00.000Z",
      },
    ],
  },
];

/* --- Quality ------------------------------------------------------------- */

export const QUALITY_FLAGS: QualityFlag[] = [
  {
    id: "qf-1",
    subjectId: DRIVERS[5].id,
    subjectName: DRIVERS[5].fullName,
    subjectAvatarUrl: DRIVERS[5].avatarUrl,
    role: UserRole.DRIVER,
    track: DriverTrack.PROFESSIONAL,
    averageRating: 2.7,
    lowRatings: 4,
    trips: 36,
    reason: "Average rating fell below 3.0 across the last ten trips.",
    flaggedAt: "2026-09-08T07:00:00.000Z",
  },
  {
    id: "qf-2",
    subjectId: DRIVERS[4].id,
    subjectName: DRIVERS[4].fullName,
    subjectAvatarUrl: DRIVERS[4].avatarUrl,
    role: UserRole.DRIVER,
    track: DriverTrack.VOLUNTEER,
    averageRating: 4.4,
    lowRatings: 2,
    trips: 37,
    reason: "Two low ratings in one week mentioning late arrival.",
    flaggedAt: "2026-09-06T07:00:00.000Z",
  },
];

/* --- Reports ------------------------------------------------------------- */

export const REPORT_SECTIONS: ReportSection[] = [
  {
    id: "adoption",
    title: "Adoption",
    description: "How the network is growing across the community.",
    metrics: [
      { id: "r-requested", label: "Rides requested", value: 1421, display: "1,421", deltaPercent: 8.2, intent: "positive" },
      { id: "r-completed", label: "Rides completed", value: 1284, display: "1,284", deltaPercent: 9.1, intent: "positive" },
      { id: "r-passengers", label: "Active passengers", value: 742, display: "742", deltaPercent: 5.4, intent: "positive" },
      { id: "r-drivers", label: "Active drivers", value: 128, display: "128", deltaPercent: 6.4, intent: "positive" },
    ],
    series: RIDE_VOLUME_SERIES,
  },
  {
    id: "verification",
    title: "Verification",
    description: "Throughput and turnaround for the verification queue.",
    metrics: [
      { id: "r-approval", label: "Approval rate", value: 87.5, display: "87.5%", deltaPercent: 2.1, intent: "positive" },
      { id: "r-time", label: "Avg. verification time", value: 3.4, display: "3.4 days", deltaPercent: -11.4, intent: "positive" },
    ],
    series: [
      { label: "Wk 1", value: 4.6 },
      { label: "Wk 2", value: 4.1 },
      { label: "Wk 3", value: 3.8 },
      { label: "Wk 4", value: 3.4 },
    ],
  },
  {
    id: "performance",
    title: "Ride performance",
    description: "Matching quality and journey completion.",
    metrics: [
      { id: "r-match", label: "Match rate", value: 91.8, display: "91.8%", deltaPercent: 2.6, intent: "positive" },
      { id: "r-complete", label: "Completion", value: 96.4, display: "96.4%", deltaPercent: 1.2, intent: "positive" },
      { id: "r-cancel", label: "Cancellations", value: 3.6, display: "3.6%", deltaPercent: -1.2, intent: "positive" },
    ],
    series: [
      { label: "Mon", value: 90 },
      { label: "Tue", value: 92 },
      { label: "Wed", value: 94 },
      { label: "Thu", value: 91 },
      { label: "Fri", value: 93 },
      { label: "Sat", value: 89 },
      { label: "Sun", value: 96 },
    ],
  },
  {
    id: "safety",
    title: "Safety",
    description: "Incidents, alerts and how quickly they are closed.",
    metrics: [
      { id: "r-incidents", label: "Incidents", value: 7, display: "7", deltaPercent: -22.2, intent: "positive" },
      { id: "r-sos", label: "SOS alerts", value: 2, display: "2", deltaPercent: 0, intent: "attention" },
      { id: "r-resolution", label: "Avg. resolution", value: 42, display: "42 min", deltaPercent: -14.8, intent: "positive" },
    ],
    series: [
      { label: "Wk 1", value: 11 },
      { label: "Wk 2", value: 9 },
      { label: "Wk 3", value: 8 },
      { label: "Wk 4", value: 7 },
    ],
  },
  {
    id: "ratings",
    title: "Ratings",
    description: "Two-way ratings across both tracks.",
    metrics: [
      { id: "r-passenger-rating", label: "Passenger rating", value: 4.86, display: "4.86", deltaPercent: 0.2, intent: "positive" },
      { id: "r-driver-rating", label: "Driver rating", value: 4.83, display: "4.83", deltaPercent: 0.4, intent: "positive" },
    ],
    series: [
      { label: "Wk 1", value: 4.78 },
      { label: "Wk 2", value: 4.8 },
      { label: "Wk 3", value: 4.81 },
      { label: "Wk 4", value: 4.83 },
    ],
  },
  {
    id: "savings",
    title: "Community savings",
    description:
      "What members would have paid on the professional track for the journeys volunteers gave freely.",
    metrics: [
      { id: "r-volunteer-rides", label: "Volunteer rides given", value: 796, display: "796", deltaPercent: 7.8, intent: "positive" },
      { id: "r-saved", label: "Estimated saving to members", value: 1_942_500, display: "\u20a61,942,500", deltaPercent: 8.4, intent: "positive" },
      { id: "r-hours", label: "Service hours given", value: 1_128, display: "1,128", deltaPercent: 6.2, intent: "positive" },
    ],
    series: [
      { label: "Wk 1", value: 402_000 },
      { label: "Wk 2", value: 448_500 },
      { label: "Wk 3", value: 512_000 },
      { label: "Wk 4", value: 580_000 },
    ],
  },
  {
    id: "retention",
    title: "Retention",
    description: "Members and drivers who keep coming back.",
    metrics: [
      { id: "r-repeat", label: "Repeat passengers", value: 68.2, display: "68.2%", deltaPercent: 3.9, intent: "positive" },
      { id: "r-driver-retention", label: "Driver retention", value: 91.1, display: "91.1%", deltaPercent: 1.1, intent: "positive" },
    ],
    series: [
      { label: "Wk 1", value: 62 },
      { label: "Wk 2", value: 64 },
      { label: "Wk 3", value: 66 },
      { label: "Wk 4", value: 68 },
    ],
  },
];
