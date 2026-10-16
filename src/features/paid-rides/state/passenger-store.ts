"use client";

import { create } from "zustand";
import { accountSession, accountResult } from "@/lib/account-session";
import { toRideError } from "../domain/errors";
import { emptyDraft, type BookingDraft } from "../domain/phases";
import { initialRideSession, rideSessionReducer, type RideSessionMsg, type RideSessionState } from "../domain/ride-session";
import type { FareEstimate, Place, RatingInput, RideMessage } from "../domain/types";
import { getRideService, newIdempotencyKey } from "../services";
import { dismissRideLocally, withoutDismissed } from "./dismissed-rides";
import { rememberRecentPlace } from "./preferences-store";
import { trackRideEvent } from "../analytics";

/**
 * Passenger session store.
 *
 * `session` mirrors the server's ride through the shared reducer; `draft` is
 * the booking the rider is composing. Actions call the service and feed the
 * answers back through the reducer, so the realtime path and the
 * request/response path obey the same ordering rules.
 */

interface PassengerStore {
  session: RideSessionState;
  draft: BookingDraft;
  /** Reused across retries of the same request so it can't create two rides. */
  requestKey: string;

  dispatch(msg: RideSessionMsg): void;
  setDraft(patch: Partial<BookingDraft>): void;
  resetDraft(): void;
  choosePlace(field: "pickup" | "destination", place: Place): void;

  refreshCurrentRide(): Promise<void>;
  requestRide(estimate: FareEstimate): Promise<void>;
  retrySearch(optionId: string | null): Promise<void>;
  cancelRide(reason: string | null): Promise<void>;
  rateRide(input: Omit<RatingInput, "rideId">): Promise<boolean>;
  dismissRide(): void;
  sendMessage(body: string): Promise<void>;
  retryMessage(message: RideMessage): Promise<void>;
}

let refreshInFlight: Promise<void> | null = null;

export const usePassengerStore = create<PassengerStore>()((set, get) => {
  const dispatch = (msg: RideSessionMsg) => set((state) => ({ session: rideSessionReducer(state.session, msg) }));

  return {
    session: initialRideSession,
    draft: emptyDraft,
    requestKey: newIdempotencyKey(),

    dispatch,

    setDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),

    resetDraft: () => set((state) => ({ draft: { ...emptyDraft, pickup: state.draft.pickup }, requestKey: newIdempotencyKey() })),

    choosePlace: (field, place) => {
      if (place.source === "search") rememberRecentPlace(place);
      set((state) => {
        const draft = { ...state.draft, [field]: place, optionId: null };
        // Once both ends are known, go straight to the route preview;
        // otherwise ask for the missing end.
        const complete = Boolean(draft.pickup && draft.destination);
        return {
          draft: { ...draft, step: complete ? "options" : "search", field: complete ? draft.field : field === "pickup" ? "destination" : "pickup" },
          requestKey: newIdempotencyKey(),
        };
      });
      if (field === "destination") trackRideEvent("destination_selected");
    },

    refreshCurrentRide: () => {
      // Visibility, focus, reconnect and gap detection can all ask at once.
      refreshInFlight ??= (async () => {
        const scope = accountSession.capture();
        if (accountSession.isBlocked()) return;
        dispatch({ type: "BOOTSTRAP_START" });
        try {
          const ride = withoutDismissed(await accountResult(scope, getRideService().getCurrentRide()));
          dispatch({ type: "BOOTSTRAP_SUCCESS", ride });
        } catch (error) {
          if (!scope.isCurrent()) return;
          dispatch({ type: "BOOTSTRAP_FAILURE", code: toRideError(error).code });
        } finally {
          if (scope.isCurrent()) refreshInFlight = null;
        }
      })();
      return refreshInFlight;
    },

    requestRide: async (estimate) => {
      const scope = accountSession.capture();
      if (accountSession.isBlocked()) return;
      const { draft, requestKey, session } = get();
      if (session.pending || !draft.pickup || !draft.destination || !draft.optionId) return;
      dispatch({ type: "ACTION_START", action: "request" });
      trackRideEvent("ride_requested", { option: draft.optionId });
      try {
        const ride = await accountResult(scope, getRideService().requestRide(
          {
            estimateId: estimate.estimateId,
            optionId: draft.optionId,
            paymentMethodId: draft.paymentMethodId ?? estimate.defaultPaymentMethodId,
            pickup: draft.pickup,
            destination: draft.destination,
          },
          { idempotencyKey: requestKey },
        ));
        dispatch({ type: "ACTION_SUCCESS", action: "request", ride });
        set({ draft: { ...emptyDraft, pickup: draft.pickup }, requestKey: newIdempotencyKey() });
      } catch (error) {
        if (!scope.isCurrent()) return;
        const code = toRideError(error).code;
        dispatch({ type: "ACTION_FAILURE", action: "request", code });
        // The request may have reached the server before the connection
        // failed; the server's answer decides, not our guess.
        if (code === "network" || code === "timeout" || code === "conflict") void get().refreshCurrentRide();
      }
    },

    retrySearch: async (optionId) => {
      const scope = accountSession.capture();
      if (accountSession.isBlocked()) return;
      const ride = get().session.ride;
      if (!ride) return;
      dispatch({ type: "ACTION_START", action: "request" });
      try {
        const next = await accountResult(scope, getRideService().retrySearch(ride.id, optionId, { idempotencyKey: newIdempotencyKey() }));
        dispatch({ type: "ACTION_SUCCESS", action: "request", ride: next });
      } catch (error) {
        if (!scope.isCurrent()) return;
        dispatch({ type: "ACTION_FAILURE", action: "request", code: toRideError(error).code });
      }
    },

    cancelRide: async (reason) => {
      const scope = accountSession.capture();
      if (accountSession.isBlocked()) return;
      const ride = get().session.ride;
      if (!ride) return;
      dispatch({ type: "ACTION_START", action: "cancel" });
      try {
        const next = await accountResult(scope, getRideService().cancelRide(ride.id, reason, { idempotencyKey: `cancel:${ride.id}` }));
        dispatch({ type: "ACTION_SUCCESS", action: "cancel", ride: next });
        trackRideEvent("ride_cancelled", { by: "passenger" });
      } catch (error) {
        if (!scope.isCurrent()) return;
        dispatch({ type: "ACTION_FAILURE", action: "cancel", code: toRideError(error).code });
        void get().refreshCurrentRide();
      }
    },

    rateRide: async (input) => {
      const scope = accountSession.capture();
      if (accountSession.isBlocked()) return false;
      const ride = get().session.ride;
      if (!ride) return false;
      dispatch({ type: "ACTION_START", action: "rate" });
      try {
        const next = await accountResult(scope, getRideService().rateRide({ ...input, rideId: ride.id }, { idempotencyKey: `rate:${ride.id}` }));
        dispatch({ type: "ACTION_SUCCESS", action: "rate", ride: next });
        trackRideEvent("driver_rated", { stars: input.stars });
        return true;
      } catch (error) {
        if (!scope.isCurrent()) return false;
        dispatch({ type: "ACTION_FAILURE", action: "rate", code: toRideError(error).code });
        return false;
      }
    },

    dismissRide: () => {
      const ride = get().session.ride;
      if (ride) dismissRideLocally(ride.id);
      dispatch({ type: "RIDE_DISMISSED" });
      set((state) => ({ draft: { ...emptyDraft, pickup: state.draft.pickup } }));
    },

    sendMessage: async (body) => {
      const scope = accountSession.capture();
      if (accountSession.isBlocked()) return;
      const ride = get().session.ride;
      const text = body.trim();
      if (!ride || !text) return;
      const clientId = newIdempotencyKey();
      dispatch({
        type: "MESSAGE_OPTIMISTIC",
        message: { id: clientId, clientId, rideId: ride.id, from: "me", body: text, sentAt: new Date().toISOString(), status: "sending" },
      });
      try {
        const message = await accountResult(scope, getRideService().sendMessage({ rideId: ride.id, clientId, body: text }, { idempotencyKey: clientId }));
        dispatch({ type: "MESSAGE_CONFIRMED", clientId, message });
      } catch {
        if (!scope.isCurrent()) return;
        dispatch({ type: "MESSAGE_FAILED", clientId });
      }
    },

    retryMessage: async (message) => {
      const scope = accountSession.capture();
      if (accountSession.isBlocked()) return;
      const ride = get().session.ride;
      if (!ride || !message.clientId) return;
      dispatch({ type: "MESSAGE_OPTIMISTIC", message: { ...message, status: "sending" } });
      try {
        const confirmed = await accountResult(scope, getRideService().sendMessage(
          { rideId: ride.id, clientId: message.clientId, body: message.body },
          { idempotencyKey: message.clientId },
        ));
        dispatch({ type: "MESSAGE_CONFIRMED", clientId: message.clientId, message: confirmed });
      } catch {
        if (!scope.isCurrent()) return;
        dispatch({ type: "MESSAGE_FAILED", clientId: message.clientId });
      }
    },
  };
});

accountSession.subscribe(() => {
  refreshInFlight = null;
  usePassengerStore.setState({ session: initialRideSession, draft: { ...emptyDraft }, requestKey: newIdempotencyKey() });
});
