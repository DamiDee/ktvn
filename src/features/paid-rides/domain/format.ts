import type { Money } from "./types.ts";

/**
 * Number formatting for rides. ETA and prices are split into a value and a
 * unit so the value can carry the visual weight ("4" big, "min" small).
 */

export interface SplitValue {
  value: string;
  unit: string;
  /** Full phrase for screen readers, e.g. "4 minutes". */
  spoken: string;
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string): Intl.NumberFormat {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    moneyFormatters.set(currency, formatter);
  }
  return formatter;
}

/** Most currencies use two minor digits; NGN is kobo. */
export function majorUnits(money: Money): number {
  return money.amountMinor / 100;
}

export function formatMoney(money: Money): string {
  const formatted = moneyFormatter(money.currency).format(Math.abs(majorUnits(money)));
  return money.amountMinor < 0 ? `−${formatted}` : formatted;
}

export function formatMoneyRange(low: Money, high: Money): string {
  return `${formatMoney(low)}–${formatMoney(high).replace(/^[^\d]+/, "")}`;
}

/** Minutes are rounded up: a driver 70 seconds away is "2 min", never "1 min". */
export function splitDuration(seconds: number): SplitValue {
  if (!Number.isFinite(seconds) || seconds < 45) return { value: "1", unit: "min", spoken: "under a minute" };
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return { value: String(minutes), unit: "min", spoken: `${minutes} minute${minutes === 1 ? "" : "s"}` };
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? { value: String(hours), unit: "hr", spoken: `${hours} hour${hours === 1 ? "" : "s"}` }
    : { value: `${hours}:${String(rest).padStart(2, "0")}`, unit: "hr", spoken: `${hours} hour${hours === 1 ? "" : "s"} ${rest} minutes` };
}

export function splitDistance(meters: number): SplitValue {
  if (!Number.isFinite(meters) || meters < 0) return { value: "–", unit: "", spoken: "unknown distance" };
  if (meters < 950) {
    const rounded = Math.max(10, Math.round(meters / 10) * 10);
    return { value: String(rounded), unit: "m", spoken: `${rounded} metres` };
  }
  const km = meters / 1000;
  const value = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return { value, unit: "km", spoken: `${value} kilometres` };
}

export function formatDuration(seconds: number): string {
  const split = splitDuration(seconds);
  return `${split.value} ${split.unit}`;
}

export function formatDistance(meters: number): string {
  const split = splitDistance(meters);
  return split.unit ? `${split.value} ${split.unit}` : split.value;
}

/** Clock time of arrival, e.g. "14:32", in the rider's locale. */
export function formatArrivalClock(secondsFromNow: number, now: number = Date.now()): string {
  return new Intl.DateTimeFormat("en-NG", { hour: "2-digit", minute: "2-digit" }).format(new Date(now + secondsFromNow * 1000));
}

export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}
