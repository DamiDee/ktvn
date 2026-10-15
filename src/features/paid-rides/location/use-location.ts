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
 * fallback when the socket is down.
 */
export function useDriverLocationReporter(active: boolean): void {
  const fix = useLocationStore((state) => state.fix);
  const lastSent = useRef<SentFix | null>(null);
  /** Wall-clock time of the last transmission, for the heartbeat timer. */
  const lastSentAt = useRef(0);
  useLocationWatch(active);

  useEffect(() => {
    if (!active || !fix) return;
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

  // A stationary device may not report new fixes at all; repeat the latest
  // one so the driver doesn't drop out of matching while parked.
  useEffect(() => {
    if (!active) return;
    const { maxIntervalMs } = PAID_RIDES_CONFIG.location.transmit;
    const timer = setInterval(() => {
      const latest = useLocationStore.getState().fix;
      if (!latest || Date.now() - lastSentAt.current < maxIntervalMs) return;
      lastSentAt.current = Date.now();
      transmit({
        point: latest.point,
        heading: latest.heading,
        speedMps: latest.speedMps,
        accuracyMeters: latest.accuracyMeters,
        // The device still reports this position now.
        recordedAt: new Date().toISOString(),
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
