/**
 * Paid Rides configuration.
 *
 * `NEXT_PUBLIC_PAID_RIDES` is the feature flag and the data-source switch in
 * one: `off` hides the module (routes 404), `mock` runs the isolated
 * simulation, `api` talks to the real backend. It defaults to `mock` in
 * development and `off` in production, so the module can never reach
 * production users by accident.
 *
 * Every tunable here is a client-side *default*. Where the server supplies a
 * value (an offer's expiry, a location interval) the server wins.
 */

export type PaidRidesMode = "off" | "mock" | "api";

function readMode(): PaidRidesMode {
  const raw = process.env.NEXT_PUBLIC_PAID_RIDES;
  if (raw === "off" || raw === "mock" || raw === "api") return raw;
  return process.env.NODE_ENV === "production" ? "off" : "mock";
}

export const PAID_RIDES_MODE: PaidRidesMode = readMode();
export const PAID_RIDES_ENABLED = PAID_RIDES_MODE !== "off";

export const PAID_RIDES_CONFIG = {
  /** REST base for `api` mode, e.g. https://api.example.com/api/v1 */
  apiBaseUrl: process.env.NEXT_PUBLIC_PAID_RIDES_API_BASE_URL ?? "",
  /** WebSocket endpoint for `api` mode, e.g. wss://api.example.com/rides/ws */
  realtimeUrl: process.env.NEXT_PUBLIC_PAID_RIDES_REALTIME_URL ?? "",

  /** Tile templates. Empty means the OpenStreetMap default with token styling. */
  tiles: {
    light: process.env.NEXT_PUBLIC_RIDES_TILE_URL_LIGHT ?? "",
    dark: process.env.NEXT_PUBLIC_RIDES_TILE_URL_DARK ?? "",
  },

  /** Abuja city centre — the community's home, used until location resolves. */
  defaultCenter: { lat: 9.0579, lng: 7.4951 },
  defaultZoom: 13,

  /** Conceptual matching radius shown to riders; the server owns the real one. */
  searchRadiusMeters: 5_000,

  /** Used only when an offer arrives without `expiresAt`. */
  offerFallbackTtlSeconds: 20,

  /** Place search. */
  searchDebounceMs: 280,
  searchMinChars: 2,

  /** Location sampling (UI) and transmission (network) are separate budgets. */
  location: {
    acquireTimeoutMs: 12_000,
    maxFixAgeMs: 30_000,
    lowAccuracyMeters: 120,
    transmit: { minIntervalMs: 4_000, maxIntervalMs: 20_000, minDistanceMeters: 15 },
  },

  /** Realtime reconnection. */
  reconnect: { baseDelayMs: 1_000, maxDelayMs: 30_000, jitterRatio: 0.3 },
  heartbeatIntervalMs: 25_000,

  /** "Connection restored" stays visible this long before the pill hides. */
  restoredNoticeMs: 2_400,

  /** Distance under which the driver is described as "arriving". */
  arrivingThresholdMeters: 300,

  /** SOS: the hold needed to send an alert, so it can't fire from a stray tap. */
  sosHoldMs: 1_500,
  /** Local emergency number dialled by "Call emergency services". */
  emergencyNumber: "112",
  /**
   * The SOS endpoint is not yet agreed with the backend. Until it is, the
   * alert is never transmitted in `api` mode — only the emergency call works.
   */
  sosEndpointAvailable: process.env.NEXT_PUBLIC_PAID_RIDES_SOS_ENDPOINT === "on",

  /** Trip PIN is off until the product requires it. */
  tripPinRequired: false,
} as const;

/** Local-storage keys. Only non-sensitive values are ever stored. */
export const STORAGE_KEYS = {
  currentRideId: "kx-rides:current-ride-id",
  preferences: "kx-rides:preferences",
  recentPlaces: "kx-rides:recent-places",
  mockWorld: "kx-rides:mock-world",
} as const;
