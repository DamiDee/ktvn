import type { DriverPublicProfile, Money, PaymentMethodSummary, Vehicle, VehicleClass } from "../../domain/types.ts";

/**
 * Fixtures for the development simulation only. Nothing outside
 * `services/mock/` and the mock realtime client may import this file.
 */

export const MOCK_CURRENCY = "NGN";

export function naira(amount: number): Money {
  return { amountMinor: Math.round(amount * 100), currency: MOCK_CURRENCY };
}

export interface MockProduct {
  id: string;
  name: string;
  description: string;
  vehicleClass: VehicleClass;
  capacity: number;
  shared: boolean;
  multiplier: number;
  /** Seconds a driver would typically need to reach the rider. */
  pickupEtaSeconds: number;
}

/** Ride products as a backend would configure them — data, not UI truth. */
export const MOCK_PRODUCTS: MockProduct[] = [
  { id: "prod-go", name: "Go", description: "Everyday rides at the lowest fare", vehicleClass: "compact", capacity: 4, shared: false, multiplier: 1, pickupEtaSeconds: 240 },
  { id: "prod-share", name: "Share", description: "Split the trip with riders going your way", vehicleClass: "compact", capacity: 2, shared: true, multiplier: 0.74, pickupEtaSeconds: 360 },
  { id: "prod-comfort", name: "Comfort", description: "Newer cars with extra legroom", vehicleClass: "sedan", capacity: 4, shared: false, multiplier: 1.3, pickupEtaSeconds: 300 },
  { id: "prod-xl", name: "XL", description: "Room for six and their luggage", vehicleClass: "van", capacity: 6, shared: false, multiplier: 1.65, pickupEtaSeconds: 480 },
  { id: "prod-premium", name: "Premium", description: "Top-rated drivers in premium cars", vehicleClass: "premium", capacity: 4, shared: false, multiplier: 2.2, pickupEtaSeconds: 540 },
];

export const MOCK_PAYMENT_METHODS: PaymentMethodSummary[] = [
  { id: "pm-cash", kind: "cash", label: "Cash" },
  { id: "pm-card", kind: "card", label: "Visa", last4: "4242" },
  { id: "pm-transfer", kind: "transfer", label: "Bank transfer" },
];

export const MOCK_DRIVERS: Record<VehicleClass, DriverPublicProfile> = {
  compact: {
    displayName: "Emeka",
    avatarUrl: "/avatars/emeka.svg",
    rating: 4.92,
    completedRides: 1284,
    bankAccount: { bankName: "Demo Bank (test only)", accountNumber: "0000000000", accountName: "Demo recipient — do not transfer" },
    verified: true,
    vehicle: { make: "Toyota", model: "Corolla", color: "Silver", colorHex: "#c9ccce", plate: "ABJ 482 KR", vehicleClass: "compact" },
    contact: { call: "masked", callHref: "tel:+2340000000000", chat: true },
  },
  sedan: {
    displayName: "Chinedu",
    avatarUrl: "/avatars/chinedu.svg",
    rating: 4.88,
    completedRides: 906,
    bankAccount: { bankName: "Demo Bank (test only)", accountNumber: "0000000000", accountName: "Demo recipient — do not transfer" },
    verified: true,
    vehicle: { make: "Honda", model: "Accord", color: "Midnight blue", colorHex: "#1f2c45", plate: "KUJ 219 AB", vehicleClass: "sedan" },
    contact: { call: "masked", callHref: "tel:+2340000000000", chat: true },
  },
  suv: {
    displayName: "Daniel",
    avatarUrl: "/avatars/daniel.svg",
    rating: 4.95,
    completedRides: 2210,
    bankAccount: { bankName: "Demo Bank (test only)", accountNumber: "0000000000", accountName: "Demo recipient — do not transfer" },
    verified: true,
    vehicle: { make: "Toyota", model: "RAV4", color: "White", colorHex: "#f2f2ef", plate: "GWA 731 FC", vehicleClass: "suv" },
    contact: { call: "masked", callHref: "tel:+2340000000000", chat: true },
  },
  van: {
    displayName: "Samuel",
    avatarUrl: "/avatars/samuel.svg",
    rating: 4.81,
    completedRides: 642,
    bankAccount: { bankName: "Demo Bank (test only)", accountNumber: "0000000000", accountName: "Demo recipient — do not transfer" },
    verified: true,
    vehicle: { make: "Toyota", model: "Sienna", color: "Graphite", colorHex: "#3d4241", plate: "BWR 908 XA", vehicleClass: "van" },
    contact: { call: "masked", callHref: "tel:+2340000000000", chat: true },
  },
  premium: {
    displayName: "Ifeanyi",
    avatarUrl: "/avatars/ifeanyi.svg",
    rating: 4.97,
    completedRides: 3120,
    bankAccount: { bankName: "Demo Bank (test only)", accountNumber: "0000000000", accountName: "Demo recipient — do not transfer" },
    verified: true,
    vehicle: { make: "Mercedes-Benz", model: "E-Class", color: "Black", colorHex: "#141615", plate: "ABC 100 KX", vehicleClass: "premium" },
    contact: { call: "masked", callHref: "tel:+2340000000000", chat: true },
  },
};

/** The signed-in driver in mock mode. */
export const MOCK_SELF_DRIVER = {
  displayName: "Tobi Adeyemi",
  avatarUrl: "/avatars/tobi.svg",
  vehicle: { make: "Toyota", model: "Camry", color: "Pearl white", colorHex: "#efeee9", plate: "ABJ 118 KX", vehicleClass: "sedan" as VehicleClass } satisfies Vehicle,
};

/** The signed-in rider in mock mode. */
export const MOCK_SELF_PASSENGER = { displayName: "Grace Adeyemi", avatarUrl: "/avatars/grace.svg" };

/** Riders who request trips from the mock driver. */
export const MOCK_REQUESTERS = [
  { displayName: "Adaeze", rating: 4.9 },
  { displayName: "Blessing", rating: 4.8 },
  { displayName: "Deborah", rating: 5 },
  { displayName: "Sarah", rating: 4.7 },
];

/** Real Abuja places used to generate driver-side requests. */
export const MOCK_PLACES = [
  { name: "Jabi Lake Mall", secondary: "Bala Sokoto Way, Jabi", lat: 9.0721, lng: 7.4246 },
  { name: "Wuse Market", secondary: "Wuse Zone 5", lat: 9.0647, lng: 7.4728 },
  { name: "Ceddi Plaza", secondary: "Tafawa Balewa Way, Central Business District", lat: 9.0536, lng: 7.4884 },
  { name: "Millennium Park", secondary: "Maitama", lat: 9.0743, lng: 7.5028 },
  { name: "Chida Event Centre", secondary: "Utako", lat: 9.07081, lng: 7.43461 },
  { name: "Silverbird Galleria", secondary: "Central Business District", lat: 9.0497, lng: 7.4824 },
  { name: "Garki Area 11", secondary: "Garki", lat: 9.0412, lng: 7.4947 },
  { name: "Gwarinpa 1st Avenue", secondary: "Gwarinpa", lat: 9.1088, lng: 7.4045 },
];

export const MOCK_QUICK_REPLIES_FROM_DRIVER = [
  "On my way — see you shortly.",
  "I'm at the pickup point now.",
  "Traffic on the expressway, a couple of minutes more.",
  "No problem, I'll wait for you.",
];
