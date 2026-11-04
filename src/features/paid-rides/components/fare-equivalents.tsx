"use client";
import { useCurrencyEquivalents } from "@/features/rentals/currency-equivalent";
import type { Money } from "../domain/types";
const DISPLAY_CURRENCIES = ["USD", "GBP", "EUR", "GHS"] as const;
/** Fare amounts are minor units; the converter accepts whole naira. */
export function FareEquivalents({ money }: { money: Money }) {
  const converted = useCurrencyEquivalents(money.amountMinor / 100, money.currency === "NGN");
  if (money.currency !== "NGN" || money.amountMinor <= 0) return null;
  return <span className="relative block w-full basis-full border-t border-[var(--border-subtle)] pt-2 text-xs font-normal text-[var(--text-secondary)]">
    {converted.isPending ? "Loading currency equivalents…" : converted.isError ? "Currency equivalents unavailable · fare remains in NGN" : <>
      <span className="grid grid-cols-2 gap-x-3 gap-y-1">{DISPLAY_CURRENCIES.map(currency => {
        const value = converted.data.amounts[currency];
        return <span key={currency}>{Number.isFinite(value) ? `≈ ${new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "code" }).format(value)}` : `${currency} unavailable`}</span>;
      })}</span>
      <span className="mt-1 block text-[10px]">Reference rates · {new Date(converted.data.updatedAt).toLocaleDateString()}</span>
    </>}
  </span>;
}
