"use client";
import { useQuery } from "@tanstack/react-query";
import { currencies } from "./currencies";
export function CurrencyEquivalent({ amount, currency }: { amount: number; currency: keyof typeof currencies }) {
  const converted = useQuery({ queryKey: ["rental-currency", amount], queryFn: async ({ signal }) => {
    const response = await fetch(`/api/rentals/convert?amount=${amount}`, { signal });
    if (!response.ok) throw new Error("Conversion unavailable");
    return await response.json() as { updatedAt: string; amounts: Record<string, number> };
  }, staleTime: 3600_000, retry: false });
  const value = converted.data?.amounts[currency];
  return <span className="mt-2 block text-xs text-ink-secondary">{converted.isPending ? "Loading equivalent…" : converted.isError || !Number.isFinite(value) ? "Currency equivalent unavailable" : <>≈ {new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "code" }).format(value!)}<span className="mt-1 block">Rate dated {new Date(converted.data!.updatedAt).toLocaleDateString()}</span></>}</span>;
}
