"use client";

import type { ReactNode } from "react";
import { BadgeCheck, Star, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDistance, formatMoney, formatMoneyRange, splitDistance, splitDuration, type SplitValue } from "../domain/format";
import type { DriverPublicProfile, FareQuote, Money, SharedRideInfo, VehicleClass } from "../domain/types";

/**
 * Small presentational building blocks shared by passenger and driver
 * screens. No data fetching, no ride logic — props in, markup out.
 */

// ─── Numbers that carry weight ────────────────────────────────────────────

export function BigValue({ value, size = "lg", className, tone }: { value: SplitValue; size?: "md" | "lg" | "xl"; className?: string; tone?: "default" | "success" }) {
  return (
    <span className={cn("ride-num inline-flex items-baseline gap-1", tone === "success" && "text-[var(--ride-success)]", className)}>
      <span className="sr-only">{value.spoken}</span>
      <span
        aria-hidden
        className={cn(
          "font-semibold tracking-[-0.04em]",
          size === "xl" ? "text-[2.75rem] leading-none" : size === "lg" ? "text-[2rem] leading-none" : "text-[1.375rem] leading-tight",
        )}
      >
        {value.value}
      </span>
      <span aria-hidden className={cn("font-medium text-[var(--text-secondary)]", size === "md" ? "text-[0.8125rem]" : "text-[1rem]")}>
        {value.unit}
      </span>
    </span>
  );
}

export function EtaValue({ seconds, size, className }: { seconds: number; size?: "md" | "lg" | "xl"; className?: string }) {
  return <BigValue value={splitDuration(seconds)} size={size} className={className} />;
}

export function DistanceValue({ meters, size = "md", className }: { meters: number; size?: "md" | "lg" | "xl"; className?: string }) {
  return <BigValue value={splitDistance(meters)} size={size} className={className} />;
}

export function MetricRow({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid auto-cols-fr grid-flow-col divide-x divide-[var(--border-subtle)] rounded-[var(--ride-radius-md)] bg-[var(--surface-secondary)]">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-1 px-3.5 py-3">
          <dt className="ride-caption truncate">{item.label}</dt>
          <dd className="ride-num truncate text-[0.9375rem] font-semibold text-[var(--text-primary)]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ─── Money ────────────────────────────────────────────────────────────────

export function FareAmount({ fare, emphasis = "md", className }: { fare: FareQuote; emphasis?: "sm" | "md" | "lg"; className?: string }) {
  const text = formatMoney(fare.total);
  return (
    <span className={cn("ride-num font-semibold tracking-[-0.02em] whitespace-nowrap", emphasis === "lg" ? "text-[1.75rem] leading-none" : emphasis === "md" ? "text-[1.0625rem]" : "text-[0.9375rem]", className)}>
      {text}
      {fare.isEstimate && fare.range ? <span className="sr-only"> estimated</span> : null}
    </span>
  );
}

export function MoneyText({ money, className }: { money: Money; className?: string }) {
  return <span className={cn("ride-num", className)}>{formatMoney(money)}</span>;
}

export function FareBreakdown({ fare, className }: { fare: FareQuote; className?: string }) {
  return (
    <dl className={cn("space-y-2", className)}>
      {fare.breakdown.map((line) => (
        <div key={line.code} className="flex items-baseline justify-between gap-4 ride-body-sm">
          <dt className="text-[var(--text-secondary)]">{line.label}</dt>
          <dd className={cn("ride-num", line.amount.amountMinor < 0 && "text-[var(--ride-success)]")}>{formatMoney(line.amount)}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-4 border-t border-[var(--border-subtle)] pt-2.5">
        <dt className="font-semibold">{fare.isEstimate ? "Estimated total" : "Total"}</dt>
        <dd className="ride-num font-semibold">{formatMoney(fare.total)}</dd>
      </div>
      {fare.isEstimate ? (
        <p className="ride-caption pt-1">
          {fare.range ? `Most trips like this cost ${formatMoneyRange(fare.range.low, fare.range.high)}. ` : ""}
          The final fare can change with the route or waiting time.
        </p>
      ) : null}
    </dl>
  );
}

// ─── Route ────────────────────────────────────────────────────────────────

export function RouteStops({ pickup, destination, pickupHint, destinationHint, compact = false }: {
  pickup: { name: string; secondary?: string };
  destination: { name: string; secondary?: string } | null;
  pickupHint?: ReactNode;
  destinationHint?: ReactNode;
  compact?: boolean;
}) {
  return (
    <ol className="relative space-y-3 before:absolute before:top-[1.1rem] before:bottom-[1.1rem] before:left-[0.4375rem] before:w-px before:border-l-2 before:border-dotted before:border-[var(--border-strong)]" aria-label="Route">
      <li className="relative flex gap-3.5">
        <span aria-hidden className="relative z-10 mt-1.5 size-[0.9375rem] shrink-0 rounded-full border-[3.5px] border-[var(--ride-marker-pickup)] bg-[var(--surface-primary)]" />
        <div className="min-w-0 flex-1">
          <p className="sr-only">Pickup:</p>
          <p className={cn("truncate font-medium", compact ? "ride-body-sm" : "ride-body")}>{pickup.name}</p>
          {!compact && pickup.secondary ? <p className="ride-caption truncate">{pickup.secondary}</p> : null}
        </div>
        {pickupHint ? <div className="shrink-0 self-center">{pickupHint}</div> : null}
      </li>
      <li className="relative flex gap-3.5">
        <span aria-hidden className="relative z-10 mt-1.5 size-[0.9375rem] shrink-0 rounded-[4px] bg-[var(--ride-marker-destination)]" />
        <div className="min-w-0 flex-1">
          <p className="sr-only">Destination:</p>
          {destination ? (
            <>
              <p className={cn("truncate font-medium", compact ? "ride-body-sm" : "ride-body")}>{destination.name}</p>
              {!compact && destination.secondary ? <p className="ride-caption truncate">{destination.secondary}</p> : null}
            </>
          ) : (
            <p className="ride-body text-[var(--text-tertiary)]">Shown after you accept</p>
          )}
        </div>
        {destinationHint ? <div className="shrink-0 self-center">{destinationHint}</div> : null}
      </li>
    </ol>
  );
}

// ─── People and vehicles ──────────────────────────────────────────────────

export function RatingPill({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("ride-num inline-flex items-center gap-1 rounded-full bg-[var(--surface-secondary)] px-2 py-0.5 text-[0.75rem] font-semibold", className)}>
      <Star className="size-3 fill-[var(--kx-gold-500)] text-[var(--kx-gold-500)]" aria-hidden />
      {rating.toFixed(2)}
      <span className="sr-only"> star rating</span>
    </span>
  );
}

export function PersonAvatar({ name, src, size = 52, ring = false }: { name: string; src?: string; size?: number; ring?: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ride-brand-soft)] font-semibold text-[var(--kx-forest-800)] dark:text-[var(--kx-gold-200)]", ring && "ring-2 ring-[var(--ride-primary)] ring-offset-2 ring-offset-[var(--surface-primary)]")}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {src ? (
        // Small vetted avatar assets; next/image adds nothing here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} className="size-full object-cover" draggable={false} />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </span>
  );
}

export function PlateBadge({ plate }: { plate: string }) {
  return (
    <span className="ride-num inline-flex items-center rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface-primary)] px-2 py-0.5 font-mono text-[0.8125rem] font-semibold tracking-[0.06em] text-[var(--text-primary)]">
      <span className="sr-only">Plate </span>
      {plate}
    </span>
  );
}

export function DriverIdentity({ driver, emphasis = "default" }: { driver: DriverPublicProfile; emphasis?: "default" | "arrived" }) {
  const v = driver.vehicle;
  return (
    <div className="flex items-center gap-3.5">
      <div className="relative">
        <PersonAvatar name={driver.displayName} src={driver.avatarUrl} size={56} ring={emphasis === "arrived"} />
        {driver.verified ? (
          <span className="absolute -right-0.5 -bottom-0.5 rounded-full bg-[var(--surface-primary)] p-0.5">
            <BadgeCheck className="size-4 fill-[var(--kx-forest-700)] text-white dark:fill-[var(--kx-gold-500)] dark:text-[var(--kx-graphite-950)]" aria-label="Verified driver" />
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="ride-heading-md truncate">{driver.displayName}</p>
          {driver.rating ? <RatingPill rating={driver.rating} /> : null}
        </div>
        <p className="ride-body-sm truncate text-[var(--text-secondary)]">
          {v.color} {v.make} {v.model}
          {driver.completedRides ? <span className="text-[var(--text-tertiary)]"> · {driver.completedRides.toLocaleString("en-NG")} trips</span> : null}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <PlateBadge plate={v.plate} />
        <VehicleIllustration vehicleClass={v.vehicleClass} paint={v.colorHex} className="h-6 w-auto" />
      </div>
    </div>
  );
}

/** Side-view vehicle silhouettes for option cards; replaceable vector art. */
const SIDE_PATHS: Record<VehicleClass, string> = {
  compact: "M6 22 L10 14 Q12 11 16 11 L34 11 Q38 11 41 14 L46 18 Q52 19 53 23 L53 26 L6 26 Z",
  sedan: "M4 22 L9 15 Q11 12 15 12 L35 12 Q39 12 42 15 L47 18 Q55 19 56 23 L56 26 L4 26 Z",
  suv: "M4 23 L7 12 Q8 9 12 9 L40 9 Q44 9 46 12 L49 17 Q56 18 57 22 L57 26 L4 26 Z",
  van: "M3 24 L3 10 Q3 7 6 7 L42 7 Q46 7 49 11 L55 18 Q58 19 58 23 L58 26 L3 26 Z",
  premium: "M3 22 L9 15 Q11 12.5 15 12.5 L36 12.5 Q40 12.5 43 15 L49 18 Q57 18.5 58 22.5 L58 25.5 L3 25.5 Z",
};

export function VehicleIllustration({ vehicleClass, paint, className }: { vehicleClass: VehicleClass; paint?: string; className?: string }) {
  return (
    <svg viewBox="0 0 61 32" className={cn("h-9 w-auto", className)} aria-hidden>
      <ellipse cx="30" cy="29" rx="25" ry="2" fill="rgb(16 44 40 / 0.12)" />
      <path d={SIDE_PATHS[vehicleClass]} fill={paint ?? "var(--ride-vehicle-paint)"} stroke="rgb(16 44 40 / 0.25)" strokeWidth="0.6" />
      <path d={vehicleClass === "van" ? "M8 10 L40 10 Q44 10 46 13 L50 18 L8 18 Z" : "M15 14 L34 14 Q37 14 39.5 16.5 L41 18 L12 18 Z"} fill="rgb(255 255 255 / 0.55)" />
      <circle cx="15" cy="26" r="4.2" fill="var(--kx-graphite-900)" />
      <circle cx="15" cy="26" r="1.8" fill="var(--kx-neutral-300)" />
      <circle cx="46" cy="26" r="4.2" fill="var(--kx-graphite-900)" />
      <circle cx="46" cy="26" r="1.8" fill="var(--kx-neutral-300)" />
    </svg>
  );
}

export function SharedRideNote({ shared }: { shared: SharedRideInfo }) {
  const others = shared.riderCount - 1;
  return (
    <div className="flex gap-3 rounded-[var(--ride-radius-md)] bg-[color-mix(in_srgb,var(--ride-info)_9%,transparent)] p-3.5">
      <Users className="mt-0.5 size-4.5 shrink-0 text-[var(--ride-info)]" aria-hidden />
      <div className="ride-body-sm">
        <p className="font-semibold">
          {others > 0 ? `You're sharing this ride with ${others} other rider${others === 1 ? "" : "s"}.` : "Shared ride · no one else yet"}
        </p>
        <p className="text-[var(--text-secondary)]">
          {shared.seatsAvailable > 0 ? `${shared.seatsAvailable} seat${shared.seatsAvailable === 1 ? "" : "s"} still open. ` : ""}
          {shared.mayDetour
            ? `The route may include another pickup or drop-off${shared.maxExtraSeconds ? `, adding up to ${Math.round(shared.maxExtraSeconds / 60)} min` : ""}.`
            : null}
        </p>
      </div>
    </div>
  );
}

export function DistanceText({ meters }: { meters: number }) {
  return <span className="ride-num">{formatDistance(meters)}</span>;
}

// ─── Skeletons that match real geometry ───────────────────────────────────

export function OptionCardSkeleton() {
  return (
    <div className="flex items-center gap-3.5 rounded-[var(--ride-radius-lg)] border border-[var(--border-subtle)] p-3.5" aria-hidden>
      <div className="kx-skeleton h-9 w-14 rounded-[10px]" />
      <div className="flex-1 space-y-2">
        <div className="kx-skeleton h-3.5 w-24" />
        <div className="kx-skeleton h-3 w-36" />
      </div>
      <div className="kx-skeleton h-4 w-16" />
    </div>
  );
}

export function DriverCardSkeleton() {
  return (
    <div className="flex items-center gap-3.5" aria-hidden>
      <div className="kx-skeleton size-14 !rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="kx-skeleton h-4 w-28" />
        <div className="kx-skeleton h-3 w-40" />
      </div>
      <div className="kx-skeleton h-6 w-20 rounded-[6px]" />
    </div>
  );
}
