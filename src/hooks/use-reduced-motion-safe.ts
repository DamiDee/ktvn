"use client";

import { useReducedMotion } from "motion/react";

/**
 * Reduced-motion aware helpers.
 *
 * Components call `motionSafe(value, fallback)` rather than branching on the
 * boolean everywhere, so animations degrade to instant state changes without
 * losing meaning.
 */
export function useReducedMotionSafe() {
  const prefersReduced = useReducedMotion() ?? false;

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
