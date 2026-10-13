"use client";

import { useMediaQuery } from "./use-media-query";

/**
 * Reduced-motion aware helpers.
 *
 * Components call `motionSafe(value, fallback)` rather than branching on the
 * boolean everywhere, so animations degrade to instant state changes without
 * losing meaning.
 */
export function useReducedMotionSafe() {
  // Match server markup during hydration, then read the device preference.
  // Branching on Motion's client-only result caused loader SVG mismatches.
  const prefersReduced = useMediaQuery("(prefers-reduced-motion: reduce)");

  return {
    prefersReduced,
    /** Return `value` normally, `fallback` when reduced motion is preferred. */
    motionSafe<T>(value: T, fallback: T): T {
      return prefersReduced ? fallback : value;
    },
    /** Duration in seconds, collapsed to near-zero under reduced motion. */
    duration(seconds: number): number {
      return prefersReduced ? 0.001 : seconds;
    },
  };
}
