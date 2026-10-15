import type { RideErrorCode } from "./errors.ts";
import { initialRideSession, rideSessionReducer, type RideSessionMsg, type RideSessionState } from "./ride-session.ts";
import { checkSequence, rememberEvent } from "./ride-sync.ts";
import { isTerminal } from "./ride-status.ts";
import type { AcceptOutcome, DriverAvailability, Ride, RideEvent, RideOffer } from "./types.ts";

/**
 * Driver session: availability, incoming offers and the assigned ride.
 *
 * Accepting is never optimistic. Pressing Accept moves the offer to
 * `accepting`; only the server's answer decides whether it becomes a ride
 * (`accepted`) or one of the conflict outcomes. Offers that arrive while the
 * driver is busy are queued (at most one) rather than replacing the offer the
 * driver is looking at.
 */

export type OfferPhase = "incoming" | "accepting" | "declining" | "expired" | "taken" | "ineligible" | "failed";

export interface OfferState {
  offer: RideOffer;
  phase: OfferPhase;
}

export type AvailabilityPhase = "OFFLINE" | "GOING_ONLINE" | "ONLINE" | "GOING_OFFLINE" | "ON_TRIP";

export interface DriverSessionState {
  availability: AvailabilityPhase;
  availabilityError: RideErrorCode | null;
  offer: OfferState | null;
  queuedOffer: RideOffer | null;
  ride: RideSessionState;
}

export const initialDriverSession: DriverSessionState = {
  availability: "OFFLINE",
  availabilityError: null,
  offer: null,
  queuedOffer: null,
  ride: initialRideSession,
};

export type DriverSessionMsg =
  | { type: "AVAILABILITY_REQUEST"; online: boolean }
  | { type: "AVAILABILITY_CONFIRMED"; availability: DriverAvailability }
  | { type: "AVAILABILITY_FAILED"; code: RideErrorCode }
  | { type: "OFFER_RECEIVED"; offer: RideOffer }
  | { type: "OFFER_TIMED_OUT"; offerId: string }
  | { type: "ACCEPT_START"; offerId: string }
  | { type: "ACCEPT_RESULT"; offerId: string; outcome: AcceptOutcome; ride?: Ride }
  | { type: "DECLINE_START"; offerId: string }
  | { type: "DECLINE_DONE"; offerId: string }
  | { type: "OFFER_DISMISSED" }
  | { type: "RIDE"; msg: RideSessionMsg };

const OUTCOME_PHASE: Record<Exclude<AcceptOutcome, "accepted">, OfferPhase> = {
  already_taken: "taken",
  request_expired: "expired",
  driver_ineligible: "ineligible",
  network_error: "failed",
};

function isBusy(state: DriverSessionState): boolean {
  const ride = state.ride.ride;
  return ride !== null && !isTerminal(ride.status);
}

function receiveOffer(state: DriverSessionState, offer: RideOffer): DriverSessionState {
  if (state.availability !== "ONLINE" || isBusy(state)) return state;
  if (state.offer?.offer.offerId === offer.offerId || state.queuedOffer?.offerId === offer.offerId) return state;
  const current = state.offer;
  if (!current || current.phase !== "incoming" && current.phase !== "accepting" && current.phase !== "declining") {
    return { ...state, offer: { offer, phase: "incoming" } };
  }
  return { ...state, queuedOffer: offer };
}

/** After an offer resolves, the queued one (if still valid) takes its place. */
function advanceQueue(state: DriverSessionState): DriverSessionState {
  if (!state.queuedOffer) return { ...state, offer: null };
  return { ...state, offer: { offer: state.queuedOffer, phase: "incoming" }, queuedOffer: null };
}

function withOfferEvent(state: DriverSessionState, event: RideEvent): DriverSessionState {
  const payload = event.payload;
  if (payload.type === "driver.request.received") return receiveOffer(state, payload.offer);
  if (payload.type === "driver.availability.changed") return driverSessionReducer(state, { type: "AVAILABILITY_CONFIRMED", availability: payload.availability });

  if (payload.type === "driver.request.expired" || payload.type === "driver.request.withdrawn") {
    // Without an offer id (not guaranteed by the backend spec) the event's ride identifies the offer.
    const matches = (offer: RideOffer) => (payload.offerId ? offer.offerId === payload.offerId : event.rideId !== null && offer.rideId === event.rideId);
    if (state.queuedOffer && matches(state.queuedOffer)) return { ...state, queuedOffer: null };
    if (!state.offer || !matches(state.offer.offer)) return state;
    // An accept already in flight is settled by its own response.
    if (state.offer.phase === "accepting") return state;
    const phase: OfferPhase = payload.type === "driver.request.withdrawn" && payload.reason === "taken" ? "taken" : "expired";
    return { ...state, offer: { ...state.offer, phase } };
  }
  return state;
}

export function driverSessionReducer(state: DriverSessionState, msg: DriverSessionMsg): DriverSessionState {
  switch (msg.type) {
    case "AVAILABILITY_REQUEST":
      if (msg.online && (state.availability === "ONLINE" || state.availability === "GOING_ONLINE")) return state;
      if (!msg.online && (state.availability === "OFFLINE" || state.availability === "GOING_OFFLINE")) return state;
      // Going offline mid-trip is refused here; the server would refuse it too.
      if (!msg.online && isBusy(state)) return state;
      return { ...state, availability: msg.online ? "GOING_ONLINE" : "GOING_OFFLINE", availabilityError: null };
    case "AVAILABILITY_CONFIRMED": {
      const next = { ...state, availability: msg.availability as AvailabilityPhase, availabilityError: null };
      return msg.availability === "OFFLINE" ? { ...next, offer: null, queuedOffer: null } : next;
    }
    case "AVAILABILITY_FAILED":
      return {
        ...state,
        availability: state.availability === "GOING_ONLINE" ? "OFFLINE" : state.availability === "GOING_OFFLINE" ? "ONLINE" : state.availability,
        availabilityError: msg.code,
      };
    case "OFFER_RECEIVED":
      return receiveOffer(state, msg.offer);
    case "OFFER_TIMED_OUT":
      if (state.offer?.offer.offerId !== msg.offerId || state.offer.phase !== "incoming") return state;
      return { ...state, offer: { ...state.offer, phase: "expired" } };
    case "ACCEPT_START":
      if (state.offer?.offer.offerId !== msg.offerId || state.offer.phase !== "incoming") return state;
      return { ...state, offer: { ...state.offer, phase: "accepting" } };
    case "ACCEPT_RESULT": {
      if (state.offer?.offer.offerId !== msg.offerId) return state;
      if (msg.outcome === "accepted") {
        const ride = msg.ride ? rideSessionReducer(state.ride, { type: "SNAPSHOT", ride: msg.ride }) : state.ride;
        return { ...state, offer: null, queuedOffer: null, availability: "ON_TRIP", ride };
      }
      return { ...state, offer: { ...state.offer, phase: OUTCOME_PHASE[msg.outcome] } };
    }
    case "DECLINE_START":
      if (state.offer?.offer.offerId !== msg.offerId || state.offer.phase !== "incoming") return state;
      return { ...state, offer: { ...state.offer, phase: "declining" } };
    case "DECLINE_DONE":
      if (state.offer?.offer.offerId !== msg.offerId) return state;
      return advanceQueue(state);
    case "OFFER_DISMISSED":
      if (!state.offer || state.offer.phase === "incoming" || state.offer.phase === "accepting") return state;
      return advanceQueue(state);
    case "RIDE": {
      let next = state;
      if (msg.msg.type === "EVENT") {
        // Offer events share the subscription's sequence with ride events.
        const event = msg.msg.event;
        const isOfferEvent = event.payload.type.startsWith("driver.");
        if (isOfferEvent) {
          const sequence = checkSequence(state.ride.lastSeq, state.ride.seenEventIds, event);
          if (sequence.duplicate) return state;
          next = withOfferEvent(
            { ...state, ride: { ...state.ride, lastSeq: sequence.nextSeq, seenEventIds: rememberEvent(state.ride.seenEventIds, event.id) } },
            event,
          );
          return next;
        }
      }
      const ride = rideSessionReducer(next.ride, msg.msg);
      if (ride === next.ride) return next;
      const current = ride.ride;
      // Availability follows the ride: assigned → on trip, finished → online.
      let availability = next.availability;
      if (current && !isTerminal(current.status)) availability = "ON_TRIP";
      else if (availability === "ON_TRIP") availability = "ONLINE";
      return { ...next, ride, availability };
    }
  }
}

/** Seconds left on an offer, using the server deadline or the configured fallback. */
export function offerSecondsLeft(offer: RideOffer, now: number, fallbackTtlSeconds: number): number {
  const deadline = offer.expiresAt ? Date.parse(offer.expiresAt) : Date.parse(offer.receivedAt) + fallbackTtlSeconds * 1000;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function offerTotalSeconds(offer: RideOffer, fallbackTtlSeconds: number): number {
  if (!offer.expiresAt) return fallbackTtlSeconds;
  return Math.max(1, Math.round((Date.parse(offer.expiresAt) - Date.parse(offer.receivedAt)) / 1000));
}
