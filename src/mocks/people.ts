import {
  BadgeTier,
  DriverAvailability,
  DriverTrack,
  MembershipStatus,
  UserRole,
  VerificationStatus,
} from "@/types/enums";
import type {
  Driver,
  Passenger,
  User,
  Vehicle,
  VolunteerBadge,
} from "@/types/models";
import { LOCATIONS } from "./locations";

/** Avatars are generated marks, not photographs of real people. */
function avatar(seed: string): string {
  return `/avatars/${seed}.svg`;
}

/* --- Vehicles ------------------------------------------------------------ */

export const VEHICLES = {
  camry: {
    id: "veh-camry",
    make: "Toyota",
    model: "Camry",
    colour: "Blue",
    plateNumber: "ABC-123-XY",
    year: 2019,
    seats: 4,
    verified: true,
  },
  corolla: {
    id: "veh-corolla",
    make: "Toyota",
    model: "Corolla",
    colour: "Silver",
    plateNumber: "KJA-884-LM",
    year: 2018,
    seats: 4,
    verified: true,
  },
  sienna: {
    id: "veh-sienna",
    make: "Toyota",
    model: "Sienna",
    colour: "Grey",
    plateNumber: "GWA-201-PQ",
    year: 2017,
    seats: 6,
    verified: true,
  },
  elantra: {
    id: "veh-elantra",
    make: "Hyundai",
    model: "Elantra",
    colour: "White",
    plateNumber: "ABJ-556-KD",
    year: 2020,
    seats: 4,
    verified: true,
  },
  accent: {
    id: "veh-accent",
    make: "Hyundai",
    model: "Accent",
    colour: "Black",
    plateNumber: "LUG-119-TR",
    year: 2016,
    seats: 4,
    verified: false,
  },
  civic: {
    id: "veh-civic",
    make: "Honda",
    model: "Civic",
    colour: "Red",
    plateNumber: "MAI-702-VB",
    year: 2019,
    seats: 4,
    verified: true,
  },
} as const satisfies Record<string, Vehicle>;

/* --- Volunteer badges ---------------------------------------------------- */

export const VOLUNTEER_BADGES: VolunteerBadge[] = [
  {
    id: "badge-first-service",
    name: "First Service",
    description: "Completed your first volunteer journey.",
    tier: BadgeTier.BRONZE,
    earnedAt: "2026-03-14T20:40:00.000Z",
  },
  {
    id: "badge-steady-hand",
    name: "Steady Hand",
    description: "Ten volunteer journeys completed without incident.",
    tier: BadgeTier.SILVER,
    earnedAt: "2026-06-02T21:05:00.000Z",
  },
  {
    id: "badge-night-service",
    name: "Night Service",
    description: "Served on five late-night journeys after evening service.",
    tier: BadgeTier.GOLD,
    earnedAt: "2026-08-09T22:18:00.000Z",
  },
  {
    id: "badge-community-pillar",
    name: "Community Pillar",
    description: "Serve fifty members to earn this recognition.",
    tier: BadgeTier.PLATINUM,
    progress: { current: 31, target: 50 },
  },
];

/* --- Passengers ---------------------------------------------------------- */

export const PASSENGERS: Passenger[] = [
  {
    id: "usr-grace",
    fullName: "Grace Adeyemi",
    email: "grace.adeyemi@example.com",
    phone: "+234 802 118 4420",
    memberId: "KOI-2019-004821",
    role: UserRole.PASSENGER,
    avatarUrl: avatar("grace"),
    membershipStatus: MembershipStatus.VERIFIED,
    joinedAt: "2019-04-11T09:00:00.000Z",
    rating: 4.9,
    totalRides: 64,
    homeArea: "Gwarinpa",
    trustedContacts: [
      {
        id: "tc-1",
        name: "Ifeoma Adeyemi",
        phone: "+234 803 442 9917",
        relationship: "Sister",
      },
      {
        id: "tc-2",
        name: "Pastor Sunday",
        phone: "+234 809 220 1187",
        relationship: "Cell leader",
      },
    ],
  },
  {
    id: "usr-daniel",
    fullName: "Daniel Okoro",
    email: "daniel.okoro@example.com",
    phone: "+234 806 553 2210",
    memberId: "KOI-2021-011903",
    role: UserRole.PASSENGER,
    avatarUrl: avatar("daniel"),
    membershipStatus: MembershipStatus.VERIFIED,
    joinedAt: "2021-08-22T09:00:00.000Z",
    rating: 4.7,
    totalRides: 28,
    homeArea: "Life Camp",
    trustedContacts: [],
  },
  {
    id: "usr-sarah",
    fullName: "Sarah Bello",
    email: "sarah.bello@example.com",
    phone: "+234 812 907 6654",
    memberId: "KOI-2020-008117",
    role: UserRole.PASSENGER,
    avatarUrl: avatar("sarah"),
    membershipStatus: MembershipStatus.VERIFIED,
    joinedAt: "2020-01-19T09:00:00.000Z",
    rating: 4.8,
    totalRides: 41,
    homeArea: "Wuse II",
    trustedContacts: [],
  },
  {
    id: "usr-tobi",
    fullName: "Tobi Salami",
    email: "tobi.salami@example.com",
    phone: "+234 815 330 7781",
    memberId: "KOI-2024-020554",
    role: UserRole.PASSENGER,
    avatarUrl: avatar("tobi"),
    membershipStatus: MembershipStatus.ACTION_REQUIRED,
    joinedAt: "2024-11-03T09:00:00.000Z",
    rating: 4.6,
    totalRides: 6,
    homeArea: "Kubwa",
    trustedContacts: [],
  },
];

export const CURRENT_PASSENGER = PASSENGERS[0];

/* --- Drivers -------------------------------------------------------------- */

export const DRIVERS: Driver[] = [
  {
    id: "usr-chinedu",
    fullName: "Chinedu Okafor",
    email: "chinedu.okafor@example.com",
    phone: "+234 803 771 2204",
    memberId: "KOI-2018-002210",
    role: UserRole.DRIVER,
    avatarUrl: avatar("chinedu"),
    membershipStatus: MembershipStatus.VERIFIED,
    joinedAt: "2018-06-01T09:00:00.000Z",
    track: DriverTrack.PROFESSIONAL,
    availability: DriverAvailability.WAITING,
    rating: 4.9,
    totalTrips: 486,
    vehicle: VEHICLES.camry,
    verificationStatus: VerificationStatus.APPROVED,
    currentLocation: { lat: 8.9975, lng: 7.3861 },
    heading: 42,
    earningsSummary: {
      weekToDate: 42300,
      weekTrips: 18,
      averageRating: 4.9,
      dailySeries: [
        { label: "Mon", amount: 4200 },
        { label: "Tue", amount: 6100 },
        { label: "Wed", amount: 5400 },
        { label: "Thu", amount: 7300 },
        { label: "Fri", amount: 8800 },
        { label: "Sat", amount: 6500 },
        { label: "Sun", amount: 4000 },
      ],
      lastPayoutAt: "2026-09-02T10:00:00.000Z",
    },
  },
  {
    id: "usr-emeka",
    fullName: "Emeka Nwosu",
    email: "emeka.nwosu@example.com",
    phone: "+234 807 118 9932",
    memberId: "KOI-2017-001188",
    role: UserRole.DRIVER,
    avatarUrl: avatar("emeka"),
    membershipStatus: MembershipStatus.VERIFIED,
    joinedAt: "2017-02-14T09:00:00.000Z",
    track: DriverTrack.VOLUNTEER,
    availability: DriverAvailability.DESTINATION_SET,
    rating: 4.8,
    totalTrips: 132,
    vehicle: VEHICLES.corolla,
    verificationStatus: VerificationStatus.APPROVED,
    currentLocation: { lat: 8.9948, lng: 7.3822 },
    heading: 12,
    service: {
      serviceHours: 42,
      volunteerTrips: 18,
      passengersServed: 31,
      badges: VOLUNTEER_BADGES,
      nextEventConfirmed: false,
    },
  },
  {
    id: "usr-blessing",
    fullName: "Blessing Eze",
    email: "blessing.eze@example.com",
    phone: "+234 809 664 3320",
    memberId: "KOI-2020-006654",
    role: UserRole.DRIVER,
    avatarUrl: avatar("blessing"),
    membershipStatus: MembershipStatus.VERIFIED,
    joinedAt: "2020-09-30T09:00:00.000Z",
    track: DriverTrack.VOLUNTEER,
    availability: DriverAvailability.WAITING,
    rating: 4.95,
    totalTrips: 88,
    vehicle: VEHICLES.sienna,
    verificationStatus: VerificationStatus.APPROVED,
    currentLocation: { lat: 9.0121, lng: 7.3915 },
    heading: 88,
    service: {
      serviceHours: 61,
      volunteerTrips: 24,
      passengersServed: 47,
      badges: VOLUNTEER_BADGES.slice(0, 3),
      nextEventConfirmed: true,
    },
  },
  {
    id: "usr-ifeanyi",
    fullName: "Ifeanyi Obi",
    email: "ifeanyi.obi@example.com",
    phone: "+234 802 445 1123",
    memberId: "KOI-2022-013390",
    role: UserRole.DRIVER,
    avatarUrl: avatar("ifeanyi"),
    membershipStatus: MembershipStatus.VERIFIED,
    joinedAt: "2022-05-17T09:00:00.000Z",
    track: DriverTrack.PROFESSIONAL,
    availability: DriverAvailability.ON_TRIP,
    rating: 4.6,
    totalTrips: 214,
    vehicle: VEHICLES.elantra,
    verificationStatus: VerificationStatus.APPROVED,
    currentLocation: { lat: 9.0402, lng: 7.4188 },
    heading: 305,
    earningsSummary: {
      weekToDate: 28900,
      weekTrips: 12,
      averageRating: 4.6,
      dailySeries: [
        { label: "Mon", amount: 3100 },
        { label: "Tue", amount: 4400 },
        { label: "Wed", amount: 3900 },
        { label: "Thu", amount: 5200 },
        { label: "Fri", amount: 6100 },
        { label: "Sat", amount: 4100 },
        { label: "Sun", amount: 2100 },
      ],
    },
  },
  {
    id: "usr-adaeze",
    fullName: "Adaeze Uche",
    email: "adaeze.uche@example.com",
    phone: "+234 813 220 8890",
    memberId: "KOI-2023-017742",
    role: UserRole.DRIVER,
    avatarUrl: avatar("adaeze"),
    membershipStatus: MembershipStatus.VERIFIED,
    joinedAt: "2023-03-08T09:00:00.000Z",
    track: DriverTrack.VOLUNTEER,
    availability: DriverAvailability.OFFLINE,
    rating: 4.4,
    totalTrips: 37,
    vehicle: VEHICLES.civic,
    verificationStatus: VerificationStatus.INSPECTION_REQUIRED,
    currentLocation: { lat: 9.0688, lng: 7.4301 },
    heading: 190,
    service: {
      serviceHours: 19,
      volunteerTrips: 9,
      passengersServed: 14,
      badges: VOLUNTEER_BADGES.slice(0, 2),
    },
  },
  {
    id: "usr-samuel",
    fullName: "Samuel Adebayo",
    email: "samuel.adebayo@example.com",
    phone: "+234 805 991 3374",
    memberId: "KOI-2024-019903",
    role: UserRole.DRIVER,
    avatarUrl: avatar("samuel"),
    membershipStatus: MembershipStatus.VERIFIED,
    joinedAt: "2024-07-21T09:00:00.000Z",
    track: DriverTrack.PROFESSIONAL,
    availability: DriverAvailability.OFFLINE,
    rating: 2.7,
    totalTrips: 36,
    vehicle: VEHICLES.accent,
    verificationStatus: VerificationStatus.DOCUMENT_REVIEW,
    flagged: true,
    currentLocation: { lat: 9.0511, lng: 7.4602 },
    heading: 260,
    earningsSummary: {
      weekToDate: 9400,
      weekTrips: 5,
      averageRating: 2.7,
      dailySeries: [
        { label: "Mon", amount: 1200 },
        { label: "Tue", amount: 0 },
        { label: "Wed", amount: 2400 },
        { label: "Thu", amount: 1800 },
        { label: "Fri", amount: 2200 },
        { label: "Sat", amount: 1800 },
        { label: "Sun", amount: 0 },
      ],
    },
  },
];

/** The driver whose dashboard is rendered in the mock driver experience. */
export const CURRENT_DRIVER = DRIVERS[1];

export const ADMIN_USER: User = {
  id: "usr-admin",
  fullName: "Deborah Ajayi",
  email: "deborah.ajayi@koinonia.example",
  phone: "+234 800 000 0000",
  memberId: "KOI-STAFF-0007",
  role: UserRole.ADMIN,
  avatarUrl: avatar("deborah"),
  membershipStatus: MembershipStatus.VERIFIED,
  joinedAt: "2016-01-04T09:00:00.000Z",
};

export function findDriver(id: string): Driver | undefined {
  return DRIVERS.find((driver) => driver.id === id);
}

export function findPassenger(id: string): Passenger | undefined {
  return PASSENGERS.find((passenger) => passenger.id === id);
}

/** Drivers scattered near the pickup point for the matching animation. */
export const NEARBY_DRIVER_POSITIONS = [
  { id: "nd-1", lat: LOCATIONS.koinoniaCentre.lat + 0.006, lng: LOCATIONS.koinoniaCentre.lng + 0.004, track: DriverTrack.VOLUNTEER },
  { id: "nd-2", lat: LOCATIONS.koinoniaCentre.lat - 0.005, lng: LOCATIONS.koinoniaCentre.lng + 0.007, track: DriverTrack.PROFESSIONAL },
  { id: "nd-3", lat: LOCATIONS.koinoniaCentre.lat + 0.009, lng: LOCATIONS.koinoniaCentre.lng - 0.005, track: DriverTrack.PROFESSIONAL },
  { id: "nd-4", lat: LOCATIONS.koinoniaCentre.lat - 0.008, lng: LOCATIONS.koinoniaCentre.lng - 0.006, track: DriverTrack.VOLUNTEER },
];
