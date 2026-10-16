"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { accountSession } from "@/lib/account-session";
import { STORAGE_KEYS } from "../config";
import { isLive } from "../domain/ride-status";
import { useLifecycleRecovery } from "../hooks/use-lifecycle-recovery";
import { getRealtimeClient } from "../realtime";
import { useDriverLocationReporter } from "../location/use-location";
import { useDriverStore } from "./driver-store";
import { usePassengerStore } from "./passenger-store";

/**
 * Session orchestration. Mounted once by the Paid Rides shell for the active
 * role; screens only read the stores.
 *
 * Sources of truth, in order: the server snapshot (bootstrap, reconnect,
 * resume, sequence gap, polling fallback) and then realtime events. Both go
 * through the same reducer, so neither can regress the other.
 */

/** While the socket is down, poll the authoritative ride this often. */
const FALLBACK_POLL_MS = 8_000;

function rememberRideId(rideId: string | null): void {
  try {
    if (rideId) localStorage.setItem(STORAGE_KEYS.currentRideId, rideId);
    else localStorage.removeItem(STORAGE_KEYS.currentRideId);
  } catch {
    // Non-essential: only used to show a "restoring" state sooner.
  }
}

export function hadRideBeforeReload(): boolean {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEYS.currentRideId));
  } catch {
    return false;
  }
}

function useRealtimeWiring(
  onEvent: Parameters<ReturnType<typeof getRealtimeClient>["onEvent"]>[0],
  onStatus: Parameters<ReturnType<typeof getRealtimeClient>["onStatus"]>[0],
  refresh: () => void,
) {
  useEffect(() => {
    const scope = accountSession.capture();
    if (accountSession.isBlocked()) return;
    const client = getRealtimeClient();
    const offEvent = client.onEvent((event) => { if (scope.isCurrent()) onEvent(event); });
    const offStatus = client.onStatus((status) => { if (scope.isCurrent()) onStatus(status); });
    const offReconnect = client.onReconnected(() => { if (scope.isCurrent()) refresh(); });
    client.connect();
    onStatus(client.status);
    return () => {
      offEvent();
      offStatus();
      offReconnect();
      client.disconnect();
    };
  }, [onEvent, onStatus, refresh]);

  useLifecycleRecovery({
    onResume: () => {
      getRealtimeClient().reconnectNow();
      refresh();
    },
    onOffline: () => getRealtimeClient().markOffline(),
  });
}

export function usePassengerSession(): void {
  const dispatch = usePassengerStore((store) => store.dispatch);
  const refresh = usePassengerStore((store) => store.refreshCurrentRide);
  const rideId = usePassengerStore((store) => store.session.ride?.id ?? null);
  const live = usePassengerStore((store) => (store.session.ride ? isLive(store.session.ride.status) : false));
  const connection = usePassengerStore((store) => store.session.connection);
  const resyncToken = usePassengerStore((store) => store.session.resyncToken);

  useRealtimeWiring(
    // Stable references: zustand action identities never change.
    useStableEvent((event) => dispatch({ type: "EVENT", event })),
    useStableEvent((status) => dispatch({ type: "CONNECTION", status })),
    useStableEvent(() => void refresh()),
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (resyncToken > 0) void refresh();
  }, [resyncToken, refresh]);

  useEffect(() => {
    if (!rideId) return;
    const client = getRealtimeClient();
    client.subscribeToRide(rideId);
    return () => client.unsubscribeFromRide(rideId);
  }, [rideId]);

  useEffect(() => {
    rememberRideId(live ? rideId : null);
  }, [live, rideId]);

  useEffect(() => {
    if (!live) return;
    // Sequence/replay semantics are not guaranteed: reconcile even on an open socket.
    const timer = setInterval(() => void refresh(), connection === "open" ? 30_000 : FALLBACK_POLL_MS);
    return () => clearInterval(timer);
  }, [live, connection, refresh]);
}

export function useDriverSession(): void {
  const rideDispatch = useDriverStore((store) => store.rideDispatch);
  const refresh = useDriverStore((store) => store.refresh);
  const rideId = useDriverStore((store) => store.state.ride.ride?.id ?? null);
  const live = useDriverStore((store) => (store.state.ride.ride ? isLive(store.state.ride.ride.status) : false));
  const availability = useDriverStore((store) => store.state.availability);
  const connection = useDriverStore((store) => store.state.ride.connection);
  const resyncToken = useDriverStore((store) => store.state.ride.resyncToken);
  const listening = availability === "ONLINE" || availability === "ON_TRIP" || availability === "GOING_OFFLINE";
  useDriverLocationReporter(listening);

  useRealtimeWiring(
    useStableEvent((event) => rideDispatch({ type: "EVENT", event })),
    useStableEvent((status) => rideDispatch({ type: "CONNECTION", status })),
    useStableEvent(() => void refresh()),
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (resyncToken > 0) void refresh();
  }, [resyncToken, refresh]);

  useEffect(() => {
    if (!listening) return;
    const client = getRealtimeClient();
    client.subscribeToDriver();
    return () => client.unsubscribeFromDriver();
  }, [listening]);

  useEffect(() => {
    if (!rideId) return;
    const client = getRealtimeClient();
    client.subscribeToRide(rideId);
    return () => client.unsubscribeFromRide(rideId);
  }, [rideId]);

  useEffect(() => {
    if (!live && !listening) return;
    const timer = setInterval(() => void refresh(), connection === "open" ? 30_000 : FALLBACK_POLL_MS);
    return () => clearInterval(timer);
  }, [live, listening, connection, refresh]);
}

/**
 * A callback with a stable identity that always runs the latest closure.
 * Keeps socket listeners from being re-attached on every render.
 */
function useStableEvent<A extends unknown[]>(handler: (...args: A) => void): (...args: A) => void {
  const ref = useRef(handler);
  useLayoutEffect(() => {
    ref.current = handler;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
