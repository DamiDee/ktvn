import type { FareQuote, RouteGeometry } from "../../domain/types.ts";
import { naira, type MockProduct } from "./mock-fixtures.ts";

/**
 * Illustrative pricing for the simulation. Real fares come from the backend;
 * nothing in the UI depends on these numbers.
 */
const BASE = 600;
const PER_KM = 165;
const PER_MIN = 22;
const SERVICE_FEE_RATE = 0.08;
const MINIMUM = 900;

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function mockQuote(product: MockProduct, route: RouteGeometry): FareQuote {
  const km = route.distanceMeters / 1000;
  const minutes = route.durationSeconds / 60;
  const base = BASE * product.multiplier;
  const distance = km * PER_KM * product.multiplier;
  const time = minutes * PER_MIN * product.multiplier;
  const subtotal = Math.max(MINIMUM * product.multiplier, base + distance + time);
  const fee = subtotal * SERVICE_FEE_RATE;
  const discount = product.shared ? -(subtotal + fee) * 0.08 : 0;
  const total = roundTo(subtotal + fee + discount, 50);

  // Lines are rounded for display; the service fee absorbs the rounding so
  // the breakdown always sums exactly to the total.
  const lines = { base: roundTo(base, 10), distance: roundTo(distance, 10), time: roundTo(time, 10), discount: roundTo(discount, 10) };
  const feeLine = total - lines.base - lines.distance - lines.time - lines.discount;
  const breakdown = [
    { code: "base", label: "Base fare", amount: naira(lines.base) },
    { code: "distance", label: `Distance · ${km.toFixed(1)} km`, amount: naira(lines.distance) },
    { code: "time", label: `Time · ${Math.round(minutes)} min`, amount: naira(lines.time) },
    { code: "service_fee", label: "Service fee", amount: naira(feeLine) },
  ];
  if (lines.discount) breakdown.push({ code: "shared_discount", label: "Shared ride saving", amount: naira(lines.discount) });

  return {
    total: naira(total),
    range: product.shared ? undefined : { low: naira(roundTo(total * 0.94, 50)), high: naira(roundTo(total * 1.08, 50)) },
    breakdown,
    isEstimate: true,
  };
}
