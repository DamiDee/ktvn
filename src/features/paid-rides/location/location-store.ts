"use client";

import { create } from "zustand";
import { accountSession } from "@/lib/account-session";
import { PAID_RIDES_CONFIG } from "../config";
import type { GeoPoint } from "../domain/types";

/**
 * The device's location, shared by the map, pickup selection and the driver
 * reporter. Nothing here is persisted.
 *
 * `status` covers every case the UI must explain: unsupported, not yet asked,
 * asking, granted, denied, unavailable (no fix) and timed out.
 */

export type LocationStatus = "unsupported" | "idle" | "requesting" | "granted" | "denied" | "unavailable" | "timeout";

export interface DeviceFix {
  point: GeoPoint;
  accuracyMeters: number | null;
  heading: number | null;
  speedMps: number | null;
  timestamp: number;
}

interface LocationState {
  status: LocationStatus;
  fix: DeviceFix | null;
  /** Number of components currently asking for continuous updates. */
  watchers: number;
  request(): Promise<DeviceFix | null>;
  /** Start continuous updates; returns the release function. */
  watch(): () => void;
}

let watchId: number | null = null;

function supported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

function toFix(position: GeolocationPosition): DeviceFix {
  const { latitude, longitude, accuracy, heading, speed } = position.coords;
  return {
    point: { lat: latitude, lng: longitude },
    accuracyMeters: Number.isFinite(accuracy) ? accuracy : null,
    heading: heading !== null && Number.isFinite(heading) ? heading : null,
    speedMps: speed !== null && Number.isFinite(speed) ? speed : null,
    timestamp: position.timestamp,
  };
}

function statusForError(error: GeolocationPositionError): LocationStatus {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  if (error.code === error.TIMEOUT) return "timeout";
  return "unavailable";
}

export const useLocationStore = create<LocationState>()((set, get) => ({
  status: "idle",
  fix: null,
  watchers: 0,

  request: () =>
    new Promise((resolve) => {
      const scope = accountSession.capture();
      if (accountSession.isBlocked()) return resolve(null);
      if (!supported()) {
        set({ status: "unsupported" });
        return resolve(null);
      }
      if (!get().fix) set({ status: "requesting" });
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!scope.isCurrent()) return resolve(null);
          const fix = toFix(position);
          set({ status: "granted", fix });
          resolve(fix);
        },
        (error) => {
          if (!scope.isCurrent()) return resolve(null);
          // Keep an older fix on screen; only the status changes.
          set({ status: statusForError(error) });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: PAID_RIDES_CONFIG.location.acquireTimeoutMs, maximumAge: 0 },
      );
    }),

  watch: () => {
    const scope = accountSession.capture();
    if (accountSession.isBlocked()) return () => undefined;
    if (!supported()) {
      set({ status: "unsupported" });
      return () => undefined;
    }
    set((state) => ({ watchers: state.watchers + 1 }));
    if (watchId === null) {
      watchId = navigator.geolocation.watchPosition(
        (position) => { if (scope.isCurrent()) set({ status: "granted", fix: toFix(position) }); },
        (error) => { if (scope.isCurrent()) set({ status: statusForError(error) }); },
        { enableHighAccuracy: true, timeout: PAID_RIDES_CONFIG.location.acquireTimeoutMs, maximumAge: 5_000 },
      );
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (!scope.isCurrent()) return;
      const watchers = Math.max(0, get().watchers - 1);
      set({ watchers });
      // High-frequency tracking stops the moment nobody needs it.
      if (watchers === 0 && watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };
  },
}));

accountSession.subscribe(() => {
  if (watchId !== null && supported()) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  useLocationStore.setState({ status: "idle", fix: null, watchers: 0 });
});

/**
 * Ask quietly on load only when permission is already granted; otherwise the
 * prompt waits for a gesture ("Use my location").
 */
export async function locationPermissionState(): Promise<PermissionState | "unknown"> {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const result = await navigator.permissions.query({ name: "geolocation" });
    return result.state;
  } catch {
    return "unknown";
  }
}
