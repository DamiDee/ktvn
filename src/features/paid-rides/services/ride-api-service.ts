import { PAID_RIDES_CONFIG } from "../config";
import { RideServiceError, errorCodeForStatus, toRideError, type RideErrorCode } from "../domain/errors";
import type { AcceptOutcome, DriverAvailability, FareEstimate, Ride, RideMessage, Viewer } from "../domain/types";
import type { RideHistoryPage, RideService } from "./ride-service";

/**
 * HTTP implementation of RideService.
 *
 * The contract it assumes is documented in
 * docs/paid-rides/PAID_RIDES_BACKEND_REQUIREMENTS.md. Authentication follows
 * the rest of the app: HTTP-only cookies sent with `credentials: "include"`,
 * no token ever handled in JavaScript. Mutations send an `Idempotency-Key`.
 */

const REQUEST_TIMEOUT_MS = 15_000;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
}

/** Backend error codes that map directly onto a frontend code. */
const KNOWN_CODES = new Set<RideErrorCode>([
  "estimate_expired",
  "no_drivers",
  "already_taken",
  "request_expired",
  "driver_ineligible",
  "payment_failed",
  "conflict",
]);

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!PAID_RIDES_CONFIG.apiBaseUrl) throw new RideServiceError("not_supported");

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  // AbortSignal.any is Safari 17.4+; older browsers keep the caller's signal.
  const signal = !options.signal ? timeout : typeof AbortSignal.any === "function" ? AbortSignal.any([options.signal, timeout]) : options.signal;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${PAID_RIDES_CONFIG.apiBaseUrl.replace(/\/$/, "")}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    });
  } catch (error) {
    throw toRideError(error);
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = (data as { code?: string } | null)?.code;
    throw new RideServiceError(code && KNOWN_CODES.has(code as RideErrorCode) ? (code as RideErrorCode) : errorCodeForStatus(response.status), {
      status: response.status,
    });
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

const id = encodeURIComponent;

export function createApiRideService(): RideService {
  return {
    mode: "api",

    // ─── Passenger ──────────────────────────────────────────────────────
    getViewer: (signal) => request<Viewer>("/rides/me", { signal }),
    getCurrentRide: async (signal) => (await request<{ ride: Ride | null }>("/rides/current", { signal })).ride,
    getRide: (rideId, signal) => request<Ride>(`/rides/${id(rideId)}`, { signal }),
    estimateRide: ({ pickup, destination }, signal) =>
      request<FareEstimate>("/rides/estimate", { method: "POST", body: { pickup, destination }, signal }),
    requestRide: (input, { idempotencyKey, signal }) =>
      request<Ride>("/rides/request", { method: "POST", body: input, idempotencyKey, signal }),
    retrySearch: (rideId, optionId, { idempotencyKey, signal }) =>
      request<Ride>(`/rides/${id(rideId)}/retry`, { method: "POST", body: { optionId }, idempotencyKey, signal }),
    cancelRide: (rideId, reason, { idempotencyKey, signal }) =>
      request<Ride>(`/rides/${id(rideId)}/cancel`, { method: "POST", body: { reason }, idempotencyKey, signal }),
    rateRide: ({ rideId, ...rating }, { idempotencyKey, signal }) =>
      request<Ride>(`/rides/${id(rideId)}/rating`, { method: "POST", body: rating, idempotencyKey, signal }),
    getRideHistory: (cursor, signal) =>
      request<RideHistoryPage>(`/rides/history${cursor ? `?cursor=${id(cursor)}` : ""}`, { signal }),

    // ─── Driver ─────────────────────────────────────────────────────────
    getDriverAvailability: async (signal) =>
      (await request<{ availability: DriverAvailability }>("/driver/availability", { signal })).availability,
    setDriverAvailability: async (online, { idempotencyKey, signal }) =>
      (await request<{ availability: DriverAvailability }>("/driver/availability", { method: "PUT", body: { online }, idempotencyKey, signal }))
        .availability,
    getCurrentDriverRide: async (signal) => (await request<{ ride: Ride | null }>("/driver/rides/current", { signal })).ride,
    acceptOffer: async (offer, { idempotencyKey, signal }) => {
      try {
        const ride = await request<Ride>(`/driver/offers/${id(offer.offerId)}/accept`, { method: "POST", idempotencyKey, signal });
        return { outcome: "accepted", ride };
      } catch (error) {
        const rideError = toRideError(error);
        // An unanswered accept is reported as a network error; the session
        // then re-reads the current ride, which settles whether it landed.
        return { outcome: ACCEPT_OUTCOMES[rideError.code] ?? "network_error" };
      }
    },
    declineOffer: (offerId, { idempotencyKey, signal }) =>
      request<void>(`/driver/offers/${id(offerId)}/decline`, { method: "POST", idempotencyKey, signal }),
    markArrived: (rideId, { idempotencyKey, signal }) =>
      request<Ride>(`/driver/rides/${id(rideId)}/arrived`, { method: "POST", idempotencyKey, signal }),
    startRide: (rideId, pin, { idempotencyKey, signal }) =>
      request<Ride>(`/driver/rides/${id(rideId)}/start`, { method: "POST", body: pin ? { pin } : {}, idempotencyKey, signal }),
    completeRide: (rideId, { idempotencyKey, signal }) =>
      request<Ride>(`/driver/rides/${id(rideId)}/complete`, { method: "POST", idempotencyKey, signal }),
    driverCancelRide: (rideId, reason, { idempotencyKey, signal }) =>
      request<Ride>(`/driver/rides/${id(rideId)}/cancel`, { method: "POST", body: { reason }, idempotencyKey, signal }),
    getDriverHistory: (cursor, signal) =>
      request<RideHistoryPage>(`/driver/rides/history${cursor ? `?cursor=${id(cursor)}` : ""}`, { signal }),
    updateDriverLocation: (location) => request<void>("/driver/location", { method: "POST", body: location }),

    // ─── Chat ───────────────────────────────────────────────────────────
    getMessages: async (rideId, signal) => (await request<{ items: RideMessage[] }>(`/rides/${id(rideId)}/messages`, { signal })).items,
    sendMessage: ({ rideId, clientId, body }, { idempotencyKey, signal }) =>
      request<RideMessage>(`/rides/${id(rideId)}/messages`, { method: "POST", body: { clientId, body }, idempotencyKey, signal }),
    markRead: (rideId, lastMessageId) =>
      request<void>(`/rides/${id(rideId)}/messages/read`, { method: "POST", body: { lastMessageId } }),

    // ─── Safety ─────────────────────────────────────────────────────────
    triggerSos: async (input, { idempotencyKey, signal }) => {
      // Never transmit an emergency to an endpoint that hasn't been agreed.
      if (!PAID_RIDES_CONFIG.sosEndpointAvailable) throw new RideServiceError("not_supported");
      await request<void>(`/rides/${id(input.rideId)}/sos`, {
        method: "POST",
        body: { type: input.type, location: input.location, occurredAt: new Date().toISOString() },
        idempotencyKey,
        signal,
      });
    },
    reportSafetyIssue: ({ rideId, ...report }, { idempotencyKey, signal }) =>
      request<void>(`/rides/${id(rideId)}/safety-reports`, { method: "POST", body: report, idempotencyKey, signal }),
    getShareLink: async (rideId) => {
      try {
        return (await request<{ url: string | null }>(`/rides/${id(rideId)}/share-link`, { method: "POST" })).url;
      } catch {
        return null;
      }
    },
  };
}
