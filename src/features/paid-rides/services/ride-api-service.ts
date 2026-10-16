import { getSessionClient } from "@/services/session-client";
import { accountSession } from "@/lib/account-session";
import { PAID_RIDES_CONFIG, PAID_RIDES_FEATURES } from "../config";
import { RideServiceError, errorCodeForStatus, toRideError, type RideErrorCode } from "../domain/errors";
import type { AcceptOutcome, RideMessage, RideOffer } from "../domain/types";
import {
  mapAvailability,
  mapEstimate,
  mapHistoryPage,
  mapRide,
  mapRideEnvelope,
  mapViewer,
  placeToWire,
} from "./api-mappers";
import type { RideService } from "./ride-service";

/**
 * HTTP implementation of RideService.
 *
 * The contract is docs/paid-rides/openapi.json (paths /rides/*, /driver/*).
 * It is the same backend as Free Buses: `POST /auth/login` sets HTTP-only
 * `access_token` and `refresh_token` cookies, every request goes out with
 * `credentials: "include"`, and an expired access token is renewed once via
 * `POST /auth/refresh`. No token is ever handled in JavaScript.
 *
 * Mutations send an `Idempotency-Key`. The backend doesn't document honouring
 * it yet; the header is harmless if ignored.
 *
 * Responses are mapped to the domain model in `api-mappers.ts`.
 */

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * What a bare `400` means, per endpoint.
 *
 * The backend answers most failures with a plain 400 and no documented body
 * (docs/paid-rides/BACKEND_SPEC_ALIGNMENT.md, "Errors are all 400"). A
 * `{ code }` in the body always wins; otherwise a 400 is read from the
 * endpoint's OpenAPI description:
 * - accept: "Already taken or expired" → already_taken, or request_expired
 *   when the offer's own `expiresAt` has passed (see `acceptOffer`).
 * - request: "Estimate expired or invalid" → estimate_expired, so the rider
 *   gets fresh prices.
 * - retry / cancel / arrived / complete: "Invalid transition" → conflict, so
 *   the session re-reads the ride.
 * - start: "Invalid PIN or state" → wrong_pin when a PIN was sent, else conflict.
 * 409 and 410 keep their usual meaning (conflict / request_expired).
 */
const BAD_REQUEST_MEANS = {
  request: "estimate_expired",
  retry: "conflict",
  cancel: "conflict",
  arrived: "conflict",
  complete: "conflict",
  start: "conflict",
  startWithPin: "wrong_pin",
  accept: "already_taken",
} as const satisfies Record<string, RideErrorCode>;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
  /** Meaning of a 400 without a recognised body code; see BAD_REQUEST_MEANS. */
  on400?: RideErrorCode | (() => RideErrorCode);
}

/** Backend error codes that map directly onto a frontend code. */
const KNOWN_CODES = new Set<RideErrorCode>([
  "estimate_expired",
  "no_drivers",
  "already_taken",
  "request_expired",
  "driver_ineligible",
  "wrong_pin",
  "payment_failed",
  "conflict",
  "validation",
]);

function bodyCode(data: unknown): RideErrorCode | null {
  const code = (data as { code?: unknown } | null)?.code;
  if (typeof code !== "string") return null;
  const normalised = code.toLowerCase() as RideErrorCode;
  return KNOWN_CODES.has(normalised) ? normalised : null;
}

function baseUrl(): string {
  return PAID_RIDES_CONFIG.apiBaseUrl.replace(/\/$/, "");
}

// Paths are passed without a leading slash so the transport can recognise
// `auth/*` and never try to refresh a refresh.
const transport = getSessionClient(baseUrl());

async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const scope = accountSession.capture();
  if (!PAID_RIDES_CONFIG.apiBaseUrl) throw new RideServiceError("not_supported");

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  // AbortSignal.any is Safari 17.4+; older browsers keep the caller's signal.
  const signal = !options.signal ? timeout : typeof AbortSignal.any === "function" ? AbortSignal.any([options.signal, timeout]) : options.signal;
  const method = options.method ?? "GET";
  // Bodiless POSTs still send `{}` so a JSON extractor on the server never rejects them.
  const body = options.body !== undefined ? JSON.stringify(options.body) : method === "GET" ? undefined : "{}";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  let response: Response;
  try {
    response = await transport.request(path.replace(/^\//, ""), {
      method,
      headers,
      body,
      signal,
    });
  } catch (error) {
    throw toRideError(error);
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  scope.assertCurrent();
  if (!response.ok) {
    const fallback = response.status === 400 && options.on400 ? (typeof options.on400 === "function" ? options.on400() : options.on400) : null;
    throw new RideServiceError(bodyCode(data) ?? fallback ?? errorCodeForStatus(response.status), { status: response.status });
  }
  return data as T;
}

const ACCEPT_OUTCOMES: Partial<Record<RideErrorCode, AcceptOutcome>> = {
  already_taken: "already_taken",
  conflict: "already_taken",
  request_expired: "request_expired",
  driver_ineligible: "driver_ineligible",
  forbidden: "driver_ineligible",
};

function offerExpired(offer: RideOffer): boolean {
  return offer.expiresAt !== null && Date.parse(offer.expiresAt) <= Date.now();
}

/** Chat has no endpoints on this backend yet; never call ones that don't exist. */
function requireChat(): void {
  if (!PAID_RIDES_FEATURES.chat) throw new RideServiceError("not_supported");
}

const id = encodeURIComponent;

function historyPath(base: string, cursor: string | null): string {
  // `nextCursor` is returned but the query parameter isn't documented yet.
  return `${base}${cursor ? `?cursor=${id(cursor)}` : ""}`;
}

export function createApiRideService(): RideService {
  return {
    mode: "api",

    // ─── Passenger ──────────────────────────────────────────────────────
    getViewer: async (signal) => mapViewer(await request("/rides/me", { signal })),
    getCurrentRide: async (signal) => mapRideEnvelope(await request("/rides/current", { signal })),
    getRide: async (rideId, signal) => mapRide(await request(`/rides/${id(rideId)}`, { signal })),
    estimateRide: async ({ pickup, destination }, signal) =>
      mapEstimate(
        await request("/rides/estimate", { method: "POST", body: { pickup: placeToWire(pickup), destination: placeToWire(destination) }, signal }),
        { pickup, destination },
      ),
    requestRide: async (input, { idempotencyKey, signal }) =>
      mapRide(
        await request("/rides/request", {
          method: "POST",
          body: {
            estimateId: input.estimateId,
            optionId: input.optionId,
            // Required by RideRequestDto; cash is the only method in v1.
            paymentMethodId: input.paymentMethodId ?? "cash",
            pickup: placeToWire(input.pickup),
            destination: placeToWire(input.destination),
          },
          idempotencyKey,
          signal,
          on400: BAD_REQUEST_MEANS.request,
        }),
      ),
    retrySearch: async (rideId, optionId, { idempotencyKey, signal }) =>
      mapRide(
        await request(`/rides/${id(rideId)}/retry`, { method: "POST", body: { optionId }, idempotencyKey, signal, on400: BAD_REQUEST_MEANS.retry }),
      ),
    cancelRide: async (rideId, reason, { idempotencyKey, signal }) =>
      mapRide(
        await request(`/rides/${id(rideId)}/cancel`, { method: "POST", body: { reason }, idempotencyKey, signal, on400: BAD_REQUEST_MEANS.cancel }),
      ),
    rateRide: async ({ rideId, stars, tags, comment }, { idempotencyKey, signal }) =>
      mapRide(await request(`/rides/${id(rideId)}/rating`, { method: "POST", body: { stars, tags, comment: comment ?? null }, idempotencyKey, signal })),
    getRideHistory: async (cursor, signal) => mapHistoryPage(await request(historyPath("/rides/history", cursor), { signal })),

    // ─── Driver ─────────────────────────────────────────────────────────
    getDriverAvailability: async (signal) => mapAvailability(await request("/driver/availability", { signal })),
    setDriverAvailability: async (online, { idempotencyKey, signal }) =>
      mapAvailability(await request("/driver/availability", { method: "PUT", body: { online }, idempotencyKey, signal })),
    getCurrentDriverRide: async (signal) => mapRideEnvelope(await request("/driver/rides/current", { signal })),
    acceptOffer: async (offer, { idempotencyKey, signal }) => {
      try {
        const ride = mapRide(
          await request(`/driver/offers/${id(offer.offerId)}/accept`, {
            method: "POST",
            idempotencyKey,
            signal,
            // One 400 covers both; the offer's own deadline tells them apart.
            on400: () => (offerExpired(offer) ? "request_expired" : BAD_REQUEST_MEANS.accept),
          }),
        );
        return { outcome: "accepted", ride };
      } catch (error) {
        const rideError = toRideError(error);
        // An unanswered accept is reported as a network error; the session
        // then re-reads the current ride, which settles whether it landed.
        return { outcome: ACCEPT_OUTCOMES[rideError.code] ?? "network_error" };
      }
    },
    declineOffer: async (offerId, { idempotencyKey, signal }) => {
      await request(`/driver/offers/${id(offerId)}/decline`, { method: "POST", idempotencyKey, signal });
    },
    markArrived: async (rideId, { idempotencyKey, signal }) =>
      mapRide(await request(`/driver/rides/${id(rideId)}/arrived`, { method: "POST", idempotencyKey, signal, on400: BAD_REQUEST_MEANS.arrived })),
    startRide: async (rideId, pin, { idempotencyKey, signal }) =>
      mapRide(
        await request(`/driver/rides/${id(rideId)}/start`, {
          method: "POST",
          body: { pin: pin || null },
          idempotencyKey,
          signal,
          on400: pin ? BAD_REQUEST_MEANS.startWithPin : BAD_REQUEST_MEANS.start,
        }),
      ),
    completeRide: async (rideId, { idempotencyKey, signal }) =>
      mapRide(await request(`/driver/rides/${id(rideId)}/complete`, { method: "POST", idempotencyKey, signal, on400: BAD_REQUEST_MEANS.complete })),
    driverCancelRide: async (rideId, reason, { idempotencyKey, signal }) =>
      mapRide(
        await request(`/driver/rides/${id(rideId)}/cancel`, { method: "POST", body: { reason }, idempotencyKey, signal, on400: BAD_REQUEST_MEANS.cancel }),
      ),
    getDriverHistory: async (cursor, signal) => mapHistoryPage(await request(historyPath("/driver/rides/history", cursor), { signal })),
    updateDriverLocation: async (location) => {
      await request("/driver/location", { method: "POST", body: location });
    },

    // ─── Chat (off in backend v1; see PAID_RIDES_FEATURES.chat) ─────────
    getMessages: async (rideId, signal) => {
      if (!PAID_RIDES_FEATURES.chat) return [];
      return (await request<{ items: RideMessage[] }>(`/rides/${id(rideId)}/messages`, { signal })).items;
    },
    sendMessage: async ({ rideId, clientId, body }, { idempotencyKey, signal }) => {
      requireChat();
      return request<RideMessage>(`/rides/${id(rideId)}/messages`, { method: "POST", body: { clientId, body }, idempotencyKey, signal });
    },
    markRead: async (rideId, lastMessageId) => {
      if (!PAID_RIDES_FEATURES.chat) return;
      await request(`/rides/${id(rideId)}/messages/read`, { method: "POST", body: { lastMessageId } });
    },

    // ─── Safety ─────────────────────────────────────────────────────────
    triggerSos: async (input, { idempotencyKey, signal }) => {
      // Never transmit an emergency until a safety desk is behind the endpoint.
      if (!PAID_RIDES_CONFIG.sosEndpointAvailable) throw new RideServiceError("not_supported");
      await request(`/rides/${id(input.rideId)}/sos`, {
        method: "POST",
        body: { type: input.type, location: input.location, occurredAt: new Date().toISOString() },
        idempotencyKey,
        signal,
      });
    },
    reportSafetyIssue: async ({ rideId, category, details }, { idempotencyKey, signal }) => {
      await request(`/rides/${id(rideId)}/safety-reports`, { method: "POST", body: { category, details: details ?? null }, idempotencyKey, signal });
    },
    getShareLink: async (rideId) => {
      try {
        return (await request<{ url?: string | null }>(`/rides/${id(rideId)}/share-link`, { method: "POST" }))?.url ?? null;
      } catch {
        return null;
      }
    },
  };
}
