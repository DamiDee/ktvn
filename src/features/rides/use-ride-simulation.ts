"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cumulativeDistances, pointAlongPath } from "@/lib/geo";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import type { Coordinates, RoutePath } from "@/types/models";

/**
 * Drives a vehicle along a route.
 *
 * Position is interpolated by distance so the marker moves at a constant
 * speed, and heading comes from the current segment so it faces its direction
 * of travel. Kept deliberately free of any UI so the same simulation can feed
 * the passenger map, driver map and admin map.
 */

export interface RideSimulationOptions {
  route?: RoutePath;
  /** Seconds of wall-clock time for the full route. */
  durationSeconds?: number;
  running?: boolean;
  /** Called once progress reaches 1. */
  onArrive?: () => void;
  /** Called as progress crosses this threshold — used for "driver is nearby". */
  nearThreshold?: number;
  onNear?: () => void;
}

export interface RideSimulationState {
  progress: number;
  position: Coordinates | null;
  heading: number;
  /** Minutes remaining, derived from the route duration and progress. */
  etaMinutes: number;
  arrived: boolean;
  restart: () => void;
  jumpTo: (progress: number) => void;
}

export function useRideSimulation({
  route,
  durationSeconds = 26,
  running = true,
  onArrive,
  nearThreshold = 0.78,
  onNear,
}: RideSimulationOptions): RideSimulationState {
  const { prefersReduced } = useReducedMotionSafe();
  const [progress, setProgress] = useState(0);

  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const baseProgressRef = useRef(0);
  const nearFiredRef = useRef(false);
  const arrivedFiredRef = useRef(false);

  const onArriveRef = useRef(onArrive);
  const onNearRef = useRef(onNear);
  useEffect(() => {
    onArriveRef.current = onArrive;
    onNearRef.current = onNear;
  }, [onArrive, onNear]);

  const cumulative = useMemo(
    () => (route ? cumulativeDistances(route.points) : []),
    [route],
  );

  const restart = useCallback(() => {
    baseProgressRef.current = 0;
    startRef.current = null;
    nearFiredRef.current = false;
    arrivedFiredRef.current = false;
    setProgress(0);
  }, []);

  const jumpTo = useCallback((next: number) => {
    const clamped = Math.min(1, Math.max(0, next));
    baseProgressRef.current = clamped;
    startRef.current = null;
    setProgress(clamped);
  }, []);

  useEffect(() => {
    if (!route || !running) return;

    // Reduced motion: the endpoint is derived below rather than written to
    // state, so only the arrival callback fires here.
    if (prefersReduced) {
      if (!arrivedFiredRef.current) {
        arrivedFiredRef.current = true;
        onArriveRef.current?.();
      }
      return;
    }

    function tick(now: number) {
      if (startRef.current === null) startRef.current = now;

      const elapsed = (now - startRef.current) / 1000;
      const next = Math.min(
        1,
        baseProgressRef.current + elapsed / durationSeconds,
      );

      setProgress(next);

      if (!nearFiredRef.current && next >= nearThreshold) {
        nearFiredRef.current = true;
        onNearRef.current?.();
      }

      if (next >= 1) {
        if (!arrivedFiredRef.current) {
          arrivedFiredRef.current = true;
          onArriveRef.current?.();
        }
        return;
      }

      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      // Preserve progress so pausing and resuming does not rewind.
      baseProgressRef.current = progress;
      startRef.current = null;
    };
    // `progress` is intentionally excluded — including it would restart the
    // animation on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, running, durationSeconds, nearThreshold, prefersReduced]);

  // Reduced motion jumps straight to the destination.
  const effectiveProgress = prefersReduced ? 1 : progress;

  const { position, heading } = useMemo(() => {
    if (!route || route.points.length === 0) {
      return { position: null, heading: 0 };
    }
    const point = pointAlongPath(route.points, effectiveProgress, cumulative);
    return { position: point.position, heading: point.heading };
  }, [route, effectiveProgress, cumulative]);

  const etaMinutes = route
    ? Math.max(0, route.durationMinutes * (1 - effectiveProgress))
    : 0;

  return {
    progress: effectiveProgress,
    position,
    heading,
    etaMinutes,
    arrived: effectiveProgress >= 1,
    restart,
    jumpTo,
  };
}
