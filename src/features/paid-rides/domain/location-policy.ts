import { haversineKm } from "../../../lib/geo.ts";
import type { GeoPoint } from "./types.ts";

/**
 * Location sampling and transmission are separate budgets. The map can
 * redraw on every fix; the network only hears about meaningful movement,
 * plus a slow heartbeat so the server knows the device is still there.
 * The server may tighten or relax these numbers per ride.
 */

export interface TransmitPolicy {
  minIntervalMs: number;
  maxIntervalMs: number;
  minDistanceMeters: number;
}

export interface SentFix {
  point: GeoPoint;
  at: number;
}

export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  return haversineKm(a, b) * 1000;
}

export function shouldTransmit(last: SentFix | null, next: SentFix, policy: TransmitPolicy): boolean {
  if (!last) return true;
  const elapsed = next.at - last.at;
  if (elapsed < 0) return false;
  if (elapsed >= policy.maxIntervalMs) return true;
  if (elapsed < policy.minIntervalMs) return false;
  return distanceMeters(last.point, next.point) >= policy.minDistanceMeters;
}

export type FixQuality = "good" | "low-accuracy" | "stale";

export function classifyFix(
  fix: { accuracyMeters: number | null; timestamp: number },
  now: number,
  limits: { maxFixAgeMs: number; lowAccuracyMeters: number },
): FixQuality {
  if (now - fix.timestamp > limits.maxFixAgeMs) return "stale";
  if (fix.accuracyMeters !== null && fix.accuracyMeters > limits.lowAccuracyMeters) return "low-accuracy";
  return "good";
}

/** Reconnect delay: exponential with jitter, capped. `attempt` starts at 0. */
export function backoffDelay(
  attempt: number,
  options: { baseDelayMs: number; maxDelayMs: number; jitterRatio: number },
  random: () => number = Math.random,
): number {
  const exponential = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** Math.max(0, attempt));
  const jitter = exponential * options.jitterRatio * (random() * 2 - 1);
  return Math.round(Math.min(options.maxDelayMs, Math.max(options.baseDelayMs / 2, exponential + jitter)));
}
