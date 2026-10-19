"use client";

import { create } from "zustand";
import { accountSession, accountResult } from "@/lib/account-session";
import { trackRideEvent } from "../analytics";
import { toRideError } from "../domain/errors";
import { isLive } from "../domain/ride-status";
import { driverSessionReducer, initialDriverSession, type DriverSessionMsg, type DriverSessionState } from "../domain/driver-session";
import type { RideAction, RideSessionMsg } from "../domain/ride-session";
import type { RideMessage } from "../domain/types";
import { getRideService, newIdempotencyKey } from "../services";
import { dismissRideLocally, withoutDismissed } from "./dismissed-rides";

/**
 * Driver session store. Every ride action waits for the server: the UI shows
 * progress on the button, and the ride only moves when the authoritative
 * response (or event) arrives.
 */

interface DriverStore {
  state: DriverSessionState;
  dispatch(msg: DriverSessionMsg): void;
  rideDispatch(msg: RideSessionMsg): void;

  refresh(): Promise<void>;
  recoverConnection(): Promise<boolean>;
  setOnline(online: boolean): Promise<void>;
  acceptOffer(): Promise<void>;
  declineOffer(): Promise<void>;
  dismissOffer(): void;
  rideAction(action: Extract<RideAction, "arrive" | "start" | "complete">, pin?: string | null): Promise<void>;
  cancelRide(reason: string): Promise<void>;
  finishSummary(): void;
  sendMessage(body: string): Promise<void>;
  retryMessage(message: RideMessage): Promise<void>;
}

let refreshInFlight: Promise<void> | null = null;
let recoveryInFlight: Promise<boolean> | null = null;
let availabilityRevision = 0;
// A manual offline request must land after any in-flight recovery PUT.
let availabilityWrites: Promise<unknown> = Promise.resolve();
function writeAvailability<T>(operation: () => Promise<T>): Promise<T> {
  const result = availabilityWrites.then(operation, operation);
  availabilityWrites = result.catch(() => undefined);
  return result;
}

export const useDriverStore = create<DriverStore>()((set, get) => {
  const dispatch = (msg: DriverSessionMsg) => set((store) => ({ state: driverSessionReducer(store.state, msg) }));
  const rideDispatch = (msg: RideSessionMsg) => dispatch({ type: "RIDE", msg });

  return {
    state: initialDriverSession,
    dispatch,
    rideDispatch,

    refresh: () => {
      refreshInFlight ??= (async () => {
        const scope = accountSession.capture();
        const revision = availabilityRevision;
        if (accountSession.isBlocked()) return;
        rideDispatch({ type: "BOOTSTRAP_START" });
        try {
          const service = getRideService();
          const [availability, ride] = await accountResult(scope, Promise.all([service.getDriverAvailability(), service.getCurrentDriverRide()]));
          if (revision === availabilityRevision && !["GOING_ONLINE", "GOING_OFFLINE"].includes(get().state.availability)) {
            dispatch({ type: "AVAILABILITY_CONFIRMED", availability });
          }
          rideDispatch({ type: "BOOTSTRAP_SUCCESS", ride: withoutDismissed(ride) });
        } catch (error) {
          if (!scope.isCurrent()) return;
          rideDispatch({ type: "BOOTSTRAP_FAILURE", code: toRideError(error).code });
        } finally {
          if (scope.isCurrent()) refreshInFlight = null;
        }
      })();
      return refreshInFlight;
    },

    recoverConnection: () => {
      if (recoveryInFlight) return recoveryInFlight;
      const scope = accountSession.capture();
      const revision = availabilityRevision;
      const current = () => scope.isCurrent() && !accountSession.isBlocked() && revision === availabilityRevision;
      const task = (async () => {
        if (!current()) return false;
        try {
          const service = getRideService();
          const [availability, ride] = await accountResult(scope, Promise.all([service.getDriverAvailability(), service.getCurrentDriverRide()]));
          if (!current() || ["GOING_ONLINE", "GOING_OFFLINE"].includes(get().state.availability)) return false;
          const currentRide = get().state.ride.ride;
          if (currentRide && isLive(currentRide.status) && (!ride || ride.id !== currentRide.id)) return false;
          dispatch({ type: "AVAILABILITY_CONFIRMED", availability });
          rideDispatch({ type: "BOOTSTRAP_SUCCESS", ride: withoutDismissed(ride) });
          // Re-register DB-online drivers in WsRegistry. Never turn an
          // offline driver on, or use ONLINE to overwrite an active trip.
          if (availability === "ONLINE" && !(ride && isLive(ride.status))) {
            await writeAvailability(async () => {
              const state = get().state;
              if (!current() || state.availability !== "ONLINE" || state.offer?.phase === "accepting" || (state.ride.ride && isLive(state.ride.ride.status))) return;
              const restored = await accountResult(scope, service.setDriverAvailability(true, { idempotencyKey: newIdempotencyKey(), signal: scope.signal }));
              if (current()) dispatch({ type: "AVAILABILITY_CONFIRMED", availability: restored });
            });
          }
          return current();
        } catch (error) {
          if (current()) rideDispatch({ type: "BOOTSTRAP_FAILURE", code: toRideError(error).code });
          return false;
        }
      })();
      recoveryInFlight = task;
      void task.finally(() => { if (recoveryInFlight === task) recoveryInFlight = null; });
      return task;
    },

    setOnline: async (online) => {
      const scope = accountSession.capture();
      if (accountSession.isBlocked()) return;
      const before = get().state.availability;
      dispatch({ type: "AVAILABILITY_REQUEST", online });
      if (get().state.availability === before) return;
      const revision = ++availabilityRevision;
      try {
        const availability = await writeAvailability(async () => {
          scope.assertCurrent();
          return accountResult(scope, getRideService().setDriverAvailability(online, { idempotencyKey: newIdempotencyKey(), signal: scope.signal }));
        });
        if (!scope.isCurrent() || revision !== availabilityRevision) return;
        dispatch({ type: "AVAILABILITY_CONFIRMED", availability });
        if (online) trackRideEvent("driver_went_online");
      } catch (error) {
        if (!scope.isCurrent() || revision !== availabilityRevision) return;
        dispatch({ type: "AVAILABILITY_FAILED", code: toRideError(error).code });
      }
    },

    acceptOffer: async () => {
      const scope = accountSession.capture();
      if (accountSession.isBlocked()) return;
      const offer = get().state.offer;
      if (!offer || offer.phase !== "incoming") return;
      const offerId = offer.offer.offerId;
      dispatch({ type: "ACCEPT_START", offerId });
      availabilityRevision += 1;
      // An already-sent recovery PUT must finish before accepting a trip,
      // otherwise its late ONLINE write could overwrite the new assignment.
      await availabilityWrites;
      if (!scope.isCurrent()) return;
      // One key per offer: a retried tap can never accept twice.
      const result = await getRideService().acceptOffer(offer.offer, { idempotencyKey: `accept:${offerId}` });
      if (!scope.isCurrent()) return;
      dispatch({ type: "ACCEPT_RESULT", offerId, outcome: result.outcome, ride: result.ride });
      if (result.outcome === "accepted") trackRideEvent("driver_accepted_request");
      // An unanswered accept may still have landed — ask the server.
      if (result.outcome === "network_error") void get().refresh();
    },

    declineOffer: async () => {
      const scope = accountSession.capture();
      if (accountSession.isBlocked()) return;
      const offer = get().state.offer;
      if (!offer || offer.phase !== "incoming") return;
      const offerId = offer.offer.offerId;
      dispatch({ type: "DECLINE_START", offerId });
      try {
        await accountResult(scope, getRideService().declineOffer(offerId, { idempotencyKey: `decline:${offerId}` }));
      } catch {
        if (!scope.isCurrent()) return;
        // Declining is advisory; an unanswered decline simply expires.
      }
      dispatch({ type: "DECLINE_DONE", offerId });
    },

    dismissOffer: () => dispatch({ type: "OFFER_DISMISSED" }),

    rideAction: async (action, pin = null) => {
      const scope = accountSession.capture();
      if (accountSession.isBlocked()) return;
      const ride = get().state.ride.ride;
      if (!ride || get().state.ride.pending) return;
      rideDispatch({ type: "ACTION_START", action });
      const service = getRideService();
      const key = `${action}:${ride.id}`;
      try {
        const next =
          action === "arrive"
            ? await accountResult(scope, service.markArrived(ride.id, { idempotencyKey: key }))
            : action === "start"
              ? await accountResult(scope, service.startRide(ride.id, pin, { idempotencyKey: key }))
              : await accountResult(scope, service.completeRide(ride.id, { idempotencyKey: key }));
        rideDispatch({ type: "ACTION_SUCCESS", action, ride: next });
        if (action === "start") trackRideEvent("trip_started");
        if (action === "complete") trackRideEvent("trip_completed");
      } catch (error) {
        if (!scope.isCurrent()) return;
        rideDispatch({ type: "ACTION_FAILURE", action, code: toRideError(error).code });
        void get().refresh();
      }
    },

    cancelRide: async (reason) => {
      const scope = accountSession.capture();
      if (accountSession.isBlocked()) return;
      const ride = get().state.ride.ride;
      if (!ride) return;
      rideDispatch({ type: "ACTION_START", action: "cancel" });
      try {
        const next = await accountResult(scope, getRideService().driverCancelRide(ride.id, reason, { idempotencyKey: `driver-cancel:${ride.id}` }));
        if (next.status === "SEARCHING") {
          // This is the passenger's re-dispatch, not a new trip for the old driver.
          rideDispatch({ type: "RIDE_DISMISSED" });
          await accountResult(scope, get().refresh());
        } else rideDispatch({ type: "ACTION_SUCCESS", action: "cancel", ride: next });
      } catch (error) {
        if (!scope.isCurrent()) return;
        rideDispatch({ type: "ACTION_FAILURE", action: "cancel", code: toRideError(error).code });
      }
    },

    finishSummary: () => {
      const ride = get().state.ride.ride;
      if (ride) dismissRideLocally(ride.id);
      rideDispatch({ type: "RIDE_DISMISSED" });
    },

    sendMessage: async (body) => {
      const scope = accountSession.capture();
      if (accountSession.isBlocked()) return;
      const ride = get().state.ride.ride;
      const text = body.trim();
      if (!ride || !text) return;
      const clientId = newIdempotencyKey();
      rideDispatch({
        type: "MESSAGE_OPTIMISTIC",
        message: { id: clientId, clientId, rideId: ride.id, from: "me", body: text, sentAt: new Date().toISOString(), status: "sending" },
      });
      try {
        const message = await accountResult(scope, getRideService().sendMessage({ rideId: ride.id, clientId, body: text }, { idempotencyKey: clientId }));
        rideDispatch({ type: "MESSAGE_CONFIRMED", clientId, message });
      } catch {
        if (!scope.isCurrent()) return;
        rideDispatch({ type: "MESSAGE_FAILED", clientId });
      }
    },

    retryMessage: async (message) => {
      const scope = accountSession.capture();
      if (accountSession.isBlocked()) return;
      const ride = get().state.ride.ride;
      if (!ride || !message.clientId) return;
      rideDispatch({ type: "MESSAGE_OPTIMISTIC", message: { ...message, status: "sending" } });
      try {
        const confirmed = await accountResult(scope, getRideService().sendMessage(
          { rideId: ride.id, clientId: message.clientId, body: message.body },
          { idempotencyKey: message.clientId },
        ));
        rideDispatch({ type: "MESSAGE_CONFIRMED", clientId: message.clientId, message: confirmed });
      } catch {
        if (!scope.isCurrent()) return;
        rideDispatch({ type: "MESSAGE_FAILED", clientId: message.clientId });
      }
    },
  };
});

accountSession.subscribe(() => {
  refreshInFlight = null;
  recoveryInFlight = null;
  availabilityRevision += 1;
  availabilityWrites = Promise.resolve();
  useDriverStore.setState({ state: initialDriverSession });
});
