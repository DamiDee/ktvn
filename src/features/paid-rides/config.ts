import { resolvePaidRidesConnection } from "./domain/configuration.ts";
export type { PaidRidesMode } from "./domain/configuration.ts";

/**
 * Paid Rides configuration.
 *
 * `NEXT_PUBLIC_PAID_RIDES` is the feature flag and the data-source switch in
 * one: `off` hides the module (routes 404), `mock` runs the isolated
 * simulation, `api` talks to the real backend. Live deployments use the API
 * by default; the explicit demo setting keeps the isolated simulation.
 *
 * Every tunable here is a client-side *default*. Where the server supplies a
 * value (an offer's expiry, a location interval) the server wins.
 */

const connection = resolvePaidRidesConnection({
  mode: process.env.NEXT_PUBLIC_PAID_RIDES,
  freeBusesMode: process.env.NEXT_PUBLIC_FREE_BUSES_MODE,
  apiBaseUrl: process.env.NEXT_PUBLIC_PAID_RIDES_API_BASE_URL,
  freeBusApiBaseUrl: process.env.NEXT_PUBLIC_FREEBUS_API_BASE_URL,
  realtimeUrl: process.env.NEXT_PUBLIC_PAID_RIDES_REALTIME_URL,
});

export const PAID_RIDES_MODE = connection.mode;
export const PAID_RIDES_ENABLED = PAID_RIDES_MODE !== "off";
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
export const USE_GOOGLE_MAPS = process.env.NEXT_PUBLIC_RIDES_MAP_PROVIDER === "google"
  || (process.env.NEXT_PUBLIC_RIDES_MAP_PROVIDER !== "osm" && Boolean(GOOGLE_MAPS_API_KEY));

export const PAID_RIDES_CONFIG = {
  /** REST base for `api` mode; the backend serves under /api/v1, e.g. https://api.example.com/api/v1 */
  apiBaseUrl: connection.apiBaseUrl,
  /**
   * WebSocket endpoint for `api` mode, e.g. wss://api.example.com/rides/ws.
   * All roles use this URL. The backend identifies drivers from the session cookie.
   */
  realtimeUrl: connection.realtimeUrl,

  /**
   * Whether the socket's `seq` may be trusted for de-duplication and gap
   * detection. The real backend's `seq` semantics are unconfirmed (its
   * examples repeat `seq: 1`), so in `api` mode events are de-duplicated by
   * id only and ride versions alone gate snapshots.
   */
  trustRealtimeSeq: false,

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
    /**
     * `maxIntervalMs` is the stationary heartbeat. The backend drops a driver
     * from its Redis presence index after 15 s without a fix, so it must stay
     * comfortably under that.
     */
    transmit: { minIntervalMs: 4_000, maxIntervalMs: 10_000, minDistanceMeters: 15 },
  },

  /** Realtime reconnection. */
  reconnect: { baseDelayMs: 1_000, maxDelayMs: 30_000, jitterRatio: 0.3 },
  heartbeatIntervalMs: 5_000,

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

/**
 * Product features that depend on the data source. The simulation has them
 * all; the real backend enables each once it exists there.
 */
export const PAID_RIDES_FEATURES = {
  /**
   * In-app chat. Off in v1 of the backend: `ContactView.chat` is always false
   * and there are no message endpoints. `NEXT_PUBLIC_PAID_RIDES_CHAT=on`
   * turns it on for `api` mode once they exist.
   */
  chat: PAID_RIDES_MODE === "mock" || process.env.NEXT_PUBLIC_PAID_RIDES_CHAT === "on",
} as const;

/** Local-storage keys. Only non-sensitive values are ever stored. */
export const STORAGE_KEYS = {
  currentRideId: "kx-rides:current-ride-id",
  preferences: "kx-rides:preferences",
  recentPlaces: "kx-rides:recent-places",
  mockWorld: "kx-rides:mock-world",
} as const;
