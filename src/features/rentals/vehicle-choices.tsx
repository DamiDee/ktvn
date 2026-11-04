"use client";
import { useState } from "react";
import { Select } from "@/components/ui/input";
import { currencies } from "./currencies";
import { CurrencyEquivalent } from "./currency-equivalent";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { VehicleIllustration } from "@/features/paid-rides/components/ride-ui";
import { rentalService } from "./service";
import type { CarType } from "./contract";
const choices = [
  { type: "Van", key: "van", description: "Roomy body style for group travel and luggage.", illustration: "van" },
  { type: "SUV", key: "suv", description: "Higher seating and a versatile cabin.", illustration: "suv" },
  { type: "Saloon", key: "saloon", description: "A traditional passenger car with a separate boot.", illustration: "sedan" },
] as const;
export function VehicleChoices({ value, disabled, onChange }: { value: CarType | ""; disabled: boolean; onChange: (value: CarType) => void }) {
  const [currency, setCurrency] = useState<keyof typeof currencies>("USD");
  const prices = useQuery({ queryKey: ["paid-rides", "rental-pricing"], queryFn: ({ signal }) => rentalService.pricing(signal), retry: false, staleTime: 60_000 });
  return <fieldset disabled={disabled} className="space-y-3"><legend className="mb-3 font-semibold">Choose a car type</legend>
    <Select label="Show approximate equivalent in" value={currency} onChange={event => setCurrency(event.target.value as keyof typeof currencies)} options={Object.entries(currencies).map(([value, label]) => ({ value, label: `${label} (${value})` }))} />
    {prices.isPending ? <p role="status">Loading rental prices…</p> : prices.isError ? <div role="alert"><p>Rental prices could not load.</p><Button variant="secondary" onClick={() => void prices.refetch()}>Retry prices</Button></div> : <div className="grid gap-3 sm:grid-cols-3">{choices.map(choice => <label key={choice.type} className={`cursor-pointer rounded-2xl border p-4 ${value === choice.type ? "border-gold-500 bg-gold-500/10" : "border-line"}`}>
      <input type="radio" name="carType" value={choice.type} checked={value === choice.type} onChange={() => onChange(choice.type)} className="mr-2" required />{choice.type}
      <VehicleIllustration vehicleClass={choice.illustration} className="my-4 h-16 w-full" />
      <span className="block text-sm text-ink-secondary">{choice.description}</span>
      <span className="mt-3 block font-semibold">{new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(prices.data.cars[choice.key].price))}</span>
      <CurrencyEquivalent amount={Number(prices.data.cars[choice.key].price)} currency={currency} />
    </label>)}</div>}
    <p className="text-xs text-ink-secondary">Payment is in NGN. Equivalents are estimates; bank rates and fees may differ. <a className="underline" href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates by ExchangeRate-API</a>.</p>
    <p className="text-xs text-ink-secondary">Illustrations show vehicle categories, not a specific car. Listed rates are subject to confirmation for your requested duration.</p>
  </fieldset>;
}
