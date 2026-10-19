"use client";

import { useEffect, useRef } from "react";
import { PAID_RIDES_CONFIG } from "../config";
import { classifyFix, shouldTransmit, type FixQuality, type SentFix } from "../domain/location-policy";
import type { LiveLocation } from "../domain/types";
import { getRealtimeClient } from "../realtime";
import { getRideService } from "../services";
import { locationPermissionState, useLocationStore, type DeviceFix } from "./location-store";

/** Fetch a fix on mount when permission was granted before; never prompts. */
export function useSilentLocation(): void {
  const request = useLocationStore((state) => state.request);
  useEffect(() => {
    let cancelled = false;
    void locationPermissionState().then((state) => {
      if (!cancelled && state === "granted") void request();
    });
    return () => {
      cancelled = true;
    };
  }, [request]);
}

/** Continuous updates while `active`; cleared as soon as it isn't. */
export function useLocationWatch(active: boolean): void {
  const watch = useLocationStore((state) => state.watch);
  useEffect(() => (active ? watch() : undefined), [active, watch]);
}

export function fixQuality(fix: DeviceFix | null, now: number): FixQuality | null {
  return fix ? classifyFix(fix, now, PAID_RIDES_CONFIG.location) : null;
}

/**
 * Driver location reporting. The map can redraw on every fix; the network
 * only hears about meaningful movement (see `shouldTransmit`), plus a
 * heartbeat every `maxIntervalMs` while parked so the server's presence
 * index (15 s TTL) keeps the driver. Realtime is preferred; REST is the
 * fallback when the socket is down. Coarse fixes (Wi-Fi positioning on a
 * laptop) are still sent with their accuracy: dropping them left the driver
 * out of the presence index, so riders saw every option as unavailable.
 */
export function useDriverLocationReporter(active: boolean): void {
  const fix = useLocationStore((state) => state.fix);
  const lastSent = useRef<SentFix | null>(null);
  /** Wall-clock time of the last transmission, for the heartbeat timer. */
  const lastSentAt = useRef(0);
  useLocationWatch(active);

  useEffect(() => {
    if (!active || !fix || classifyFix(fix, Date.now(), PAID_RIDES_CONFIG.location) === "stale") return;
    const next = { point: fix.point, at: fix.timestamp };
    if (!shouldTransmit(lastSent.current, next, PAID_RIDES_CONFIG.location.transmit)) return;
    lastSent.current = next;
    lastSentAt.current = Date.now();
    transmit({
      point: fix.point,
      heading: fix.heading,
      speedMps: fix.speedMps,
      accuracyMeters: fix.accuracyMeters,
      recordedAt: new Date(fix.timestamp).toISOString(),
    });
  }, [active, fix]);

  // Acquire a real fresh fix while parked. Never re-date old coordinates:
  // the backend must be allowed to expire drivers whose GPS has gone stale.
  useEffect(() => {
    if (!active) return;
    const { maxIntervalMs } = PAID_RIDES_CONFIG.location.transmit;
    let acquiring = false;
    const timer = setInterval(() => {
      const latest = useLocationStore.getState().fix;
      if (!latest || Date.now() - lastSentAt.current < maxIntervalMs) return;
      if (Date.now() - latest.timestamp >= maxIntervalMs) {
        if (!acquiring) {
          acquiring = true;
          void useLocationStore.getState().request().finally(() => { acquiring = false; });
        }
        return;
      }
      if (classifyFix(latest, Date.now(), PAID_RIDES_CONFIG.location) === "stale") return;
      lastSentAt.current = Date.now();
      transmit({
        point: latest.point,
        heading: latest.heading,
        speedMps: latest.speedMps,
        accuracyMeters: latest.accuracyMeters,
        recordedAt: new Date(latest.timestamp).toISOString(),
      });
    }, Math.max(1_000, Math.round(maxIntervalMs / 2)));
    return () => clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (!active) {
      lastSent.current = null;
      lastSentAt.current = 0;
    }
  }, [active]);
}

function transmit(location: LiveLocation): void {
  if (!getRealtimeClient().sendLocation(location)) {
    void getRideService().updateDriverLocation(location).catch(() => undefined);
  }
}
