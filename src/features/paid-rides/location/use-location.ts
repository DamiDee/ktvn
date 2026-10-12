"use client";

import { useEffect, useRef } from "react";
import { PAID_RIDES_CONFIG } from "../config";
import { classifyFix, shouldTransmit, type FixQuality, type SentFix } from "../domain/location-policy";
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
 * only hears about meaningful movement (see `shouldTransmit`). Realtime is
 * preferred; REST is the fallback when the socket is down.
 */
export function useDriverLocationReporter(active: boolean): void {
  const fix = useLocationStore((state) => state.fix);
  const lastSent = useRef<SentFix | null>(null);
  useLocationWatch(active);

  useEffect(() => {
    if (!active || !fix) return;
    const next = { point: fix.point, at: fix.timestamp };
    if (!shouldTransmit(lastSent.current, next, PAID_RIDES_CONFIG.location.transmit)) return;
    lastSent.current = next;
    const location = {
      point: fix.point,
      heading: fix.heading,
      speedMps: fix.speedMps,
      accuracyMeters: fix.accuracyMeters,
      recordedAt: new Date(fix.timestamp).toISOString(),
    };
    if (!getRealtimeClient().sendLocation(location)) {
      void getRideService().updateDriverLocation(location).catch(() => undefined);
    }
  }, [active, fix]);

  useEffect(() => {
    if (!active) lastSent.current = null;
  }, [active]);
}
