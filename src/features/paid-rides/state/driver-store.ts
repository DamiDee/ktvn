"use client";

import { create } from "zustand";
import { trackRideEvent } from "../analytics";
import { toRideError } from "../domain/errors";
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

export const useDriverStore = create<DriverStore>()((set, get) => {
  const dispatch = (msg: DriverSessionMsg) => set((store) => ({ state: driverSessionReducer(store.state, msg) }));
  const rideDispatch = (msg: RideSessionMsg) => dispatch({ type: "RIDE", msg });

  return {
    state: initialDriverSession,
    dispatch,
    rideDispatch,

    refresh: () => {
      refreshInFlight ??= (async () => {
        rideDispatch({ type: "BOOTSTRAP_START" });
        try {
          const service = getRideService();
          const [availability, ride] = await Promise.all([service.getDriverAvailability(), service.getCurrentDriverRide()]);
          dispatch({ type: "AVAILABILITY_CONFIRMED", availability });
          rideDispatch({ type: "BOOTSTRAP_SUCCESS", ride: withoutDismissed(ride) });
        } catch (error) {
          rideDispatch({ type: "BOOTSTRAP_FAILURE", code: toRideError(error).code });
        } finally {
          refreshInFlight = null;
        }
      })();
      return refreshInFlight;
    },

    setOnline: async (online) => {
      const before = get().state.availability;
      dispatch({ type: "AVAILABILITY_REQUEST", online });
      if (get().state.availability === before) return;
      try {
        const availability = await getRideService().setDriverAvailability(online, { idempotencyKey: newIdempotencyKey() });
        dispatch({ type: "AVAILABILITY_CONFIRMED", availability });
        if (online) trackRideEvent("driver_went_online");
      } catch (error) {
        dispatch({ type: "AVAILABILITY_FAILED", code: toRideError(error).code });
      }
    },

    acceptOffer: async () => {
      const offer = get().state.offer;
      if (!offer || offer.phase !== "incoming") return;
      const offerId = offer.offer.offerId;
      dispatch({ type: "ACCEPT_START", offerId });
      // One key per offer: a retried tap can never accept twice.
      const result = await getRideService().acceptOffer(offer.offer, { idempotencyKey: `accept:${offerId}` });
      dispatch({ type: "ACCEPT_RESULT", offerId, outcome: result.outcome, ride: result.ride });
      if (result.outcome === "accepted") trackRideEvent("driver_accepted_request");
      // An unanswered accept may still have landed — ask the server.
      if (result.outcome === "network_error") void get().refresh();
    },

    declineOffer: async () => {
      const offer = get().state.offer;
      if (!offer || offer.phase !== "incoming") return;
      const offerId = offer.offer.offerId;
      dispatch({ type: "DECLINE_START", offerId });
      try {
        await getRideService().declineOffer(offerId, { idempotencyKey: `decline:${offerId}` });
      } catch {
        // Declining is advisory; an unanswered decline simply expires.
      }
      dispatch({ type: "DECLINE_DONE", offerId });
    },

    dismissOffer: () => dispatch({ type: "OFFER_DISMISSED" }),

    rideAction: async (action, pin = null) => {
      const ride = get().state.ride.ride;
      if (!ride || get().state.ride.pending) return;
      rideDispatch({ type: "ACTION_START", action });
      const service = getRideService();
      const key = `${action}:${ride.id}`;
      try {
        const next =
          action === "arrive"
            ? await service.markArrived(ride.id, { idempotencyKey: key })
            : action === "start"
              ? await service.startRide(ride.id, pin, { idempotencyKey: key })
              : await service.completeRide(ride.id, { idempotencyKey: key });
        rideDispatch({ type: "ACTION_SUCCESS", action, ride: next });
        if (action === "start") trackRideEvent("trip_started");
        if (action === "complete") trackRideEvent("trip_completed");
      } catch (error) {
        rideDispatch({ type: "ACTION_FAILURE", action, code: toRideError(error).code });
        void get().refresh();
      }
    },

    cancelRide: async (reason) => {
      const ride = get().state.ride.ride;
      if (!ride) return;
      rideDispatch({ type: "ACTION_START", action: "cancel" });
      try {
        const next = await getRideService().driverCancelRide(ride.id, reason, { idempotencyKey: `driver-cancel:${ride.id}` });
        rideDispatch({ type: "ACTION_SUCCESS", action: "cancel", ride: next });
      } catch (error) {
        rideDispatch({ type: "ACTION_FAILURE", action: "cancel", code: toRideError(error).code });
      }
    },

    finishSummary: () => {
      const ride = get().state.ride.ride;
      if (ride) dismissRideLocally(ride.id);
      rideDispatch({ type: "RIDE_DISMISSED" });
    },

    sendMessage: async (body) => {
      const ride = get().state.ride.ride;
      const text = body.trim();
      if (!ride || !text) return;
      const clientId = newIdempotencyKey();
      rideDispatch({
        type: "MESSAGE_OPTIMISTIC",
        message: { id: clientId, clientId, rideId: ride.id, from: "me", body: text, sentAt: new Date().toISOString(), status: "sending" },
      });
      try {
        const message = await getRideService().sendMessage({ rideId: ride.id, clientId, body: text }, { idempotencyKey: clientId });
        rideDispatch({ type: "MESSAGE_CONFIRMED", clientId, message });
      } catch {
        rideDispatch({ type: "MESSAGE_FAILED", clientId });
      }
    },

    retryMessage: async (message) => {
      const ride = get().state.ride.ride;
      if (!ride || !message.clientId) return;
      rideDispatch({ type: "MESSAGE_OPTIMISTIC", message: { ...message, status: "sending" } });
      try {
        const confirmed = await getRideService().sendMessage(
          { rideId: ride.id, clientId: message.clientId, body: message.body },
          { idempotencyKey: message.clientId },
        );
        rideDispatch({ type: "MESSAGE_CONFIRMED", clientId: message.clientId, message: confirmed });
      } catch {
        rideDispatch({ type: "MESSAGE_FAILED", clientId: message.clientId });
      }
    },
  };
});
