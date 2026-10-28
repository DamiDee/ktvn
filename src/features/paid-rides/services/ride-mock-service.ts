import { RideServiceError } from "../domain/errors";
import type { FareEstimate } from "../domain/types";
import { googleMapProvider } from "../maps/google-map-provider";
import { MOCK_PAYMENT_METHODS, MOCK_SELF_DRIVER, MOCK_SELF_PASSENGER } from "./mock/mock-fixtures";
import { MockBackend } from "./mock/mock-backend";
import type { RideService } from "./ride-service";

/**
 * Development-only RideService backed by the in-browser `MockBackend`.
 *
 * Latency is simulated so loading states are visible, but all timing that
 * moves a ride forward lives in the backend simulation — this adapter only
 * translates calls, exactly like the HTTP adapter does.
 */

let backend: MockBackend | null = null;

/** Shared with the mock realtime client and the dev panel. */
export function getMockBackend(): MockBackend {
  backend ??= new MockBackend(googleMapProvider);
  return backend;
}

const LATENCY = { read: 260, write: 520, accept: 900 } as const;

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new RideServiceError("timeout"));
    const timer = setTimeout(resolve, ms * (0.75 + Math.random() * 0.5));
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new RideServiceError("timeout"));
      },
      { once: true },
    );
  });
}

function offline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

async function call<T>(ms: number, run: () => T | Promise<T>, signal?: AbortSignal): Promise<T> {
  if (offline()) throw new RideServiceError("network");
  await delay(ms, signal);
  return run();
}

const ESTIMATE_TTL_MS = 5 * 60_000;

export function createMockRideService(): RideService {
  const world = getMockBackend();

  return {
    mode: "mock",

    // ─── Passenger ──────────────────────────────────────────────────────
    getViewer: (signal) =>
      call(LATENCY.read, () => ({ ...MOCK_SELF_PASSENGER, roles: ["passenger", "driver"] as Array<"passenger" | "driver">, vehicle: MOCK_SELF_DRIVER.vehicle }), signal),
    updateAccount: async () => { throw new RideServiceError("not_supported"); },
    getCurrentRide: (signal) => call(LATENCY.read, () => world.currentPassengerRide(), signal),
    getRide: (rideId, signal) =>
      call(LATENCY.read, () => {
        const ride = world.findRide(rideId);
        if (!ride) throw new RideServiceError("not_found");
        return ride;
      }, signal),

    estimateRide: ({ pickup, destination }, signal) =>
      call(LATENCY.read, async (): Promise<FareEstimate> => {
        const { route, options } = await world.estimate(pickup, destination, signal);
        return {
          estimateId: `est_${Date.now().toString(36)}`,
          expiresAt: new Date(Date.now() + ESTIMATE_TTL_MS).toISOString(),
          route,
          options,
          paymentMethods: MOCK_PAYMENT_METHODS,
          defaultPaymentMethodId: MOCK_PAYMENT_METHODS[0].id,
        };
      }, signal),

    requestRide: async (input, { idempotencyKey, signal }) => {
      const { route } = await world.estimate(input.pickup, input.destination, signal);
      const payment = MOCK_PAYMENT_METHODS.find((method) => method.id === input.paymentMethodId) ?? MOCK_PAYMENT_METHODS[0];
      const paymentLabel = payment.last4 ? `${payment.label} •••• ${payment.last4}` : payment.label;
      return call(LATENCY.write, () =>
        world.requestRide({ optionId: input.optionId, paymentLabel, pickup: input.pickup, destination: input.destination, route }, idempotencyKey),
      signal);
    },
    retrySearch: (rideId, optionId, { signal }) => call(LATENCY.write, () => world.retrySearch(rideId, optionId), signal),
    cancelRide: (rideId, reason, { signal }) => call(LATENCY.write, () => world.cancelPassengerRide(rideId, reason), signal),
    rateRide: (input, { signal }) => call(LATENCY.write, () => world.ratePassengerRide(input.rideId, input.stars), signal),
    getRideHistory: (_cursor, signal) => call(LATENCY.read, () => ({ items: world.history("passenger"), nextCursor: null }), signal),

    // ─── Driver ─────────────────────────────────────────────────────────
    getDriverAvailability: (signal) => call(LATENCY.read, () => world.driverAvailability(), signal),
    setDriverAvailability: (online, { signal }) => call(LATENCY.write, () => world.setOnline(online), signal),
    getCurrentDriverRide: (signal) => call(LATENCY.read, () => world.currentDriverRide(), signal),
    acceptOffer: async (offer, { idempotencyKey, signal }) => {
      if (offline()) return { outcome: "network_error" };
      await delay(LATENCY.accept, signal);
      return world.accept(offer.offerId, idempotencyKey);
    },
    declineOffer: (offerId, { signal }) => call(LATENCY.read, () => world.decline(offerId), signal),
    markArrived: (rideId, { signal }) => call(LATENCY.write, () => world.driverAction(rideId, "arrive"), signal),
    startRide: (rideId, _pin, { signal }) => call(LATENCY.write, () => world.driverAction(rideId, "start"), signal),
    completeRide: (rideId, { signal }) => call(LATENCY.write, () => world.driverAction(rideId, "complete"), signal),
    driverCancelRide: (rideId, _reason, { signal }) => call(LATENCY.write, () => world.driverAction(rideId, "cancel"), signal),
    getDriverHistory: (_cursor, signal) => call(LATENCY.read, () => ({ items: world.history("driver"), nextCursor: null }), signal),
    updateDriverLocation: async (location) => {
      world.setDriverOrigin(location.point);
    },

    // ─── Chat ───────────────────────────────────────────────────────────
    getMessages: (rideId, signal) => call(LATENCY.read, () => world.messages(rideId), signal),
    sendMessage: ({ rideId, clientId, body }, { signal }) => call(LATENCY.read, () => world.sendMessage(rideId, clientId, body), signal),
    markRead: async (rideId) => world.markRead(rideId),

    // ─── Safety ─────────────────────────────────────────────────────────
    triggerSos: ({ rideId }, { signal }) => call(LATENCY.write, () => world.sos(rideId), signal),
    reportSafetyIssue: (_input, { signal }) => call(LATENCY.write, () => undefined, signal),
    getShareLink: async (rideId) => world.findRide(rideId)?.shareUrl ?? null,
  };
}
