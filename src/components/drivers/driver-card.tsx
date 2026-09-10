"use client";

import { motion } from "motion/react";
import { Phone, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { RatingValue } from "@/components/ui/rating";
import { StatusChip, VerifiedBadge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { TRACK_LABEL, TRACK_TONE } from "@/constants/status-presentation";
import { shortName } from "@/lib/format";
import { transitions } from "@/lib/motion";
import type { Driver } from "@/types/models";

/**
 * Driver identity card.
 *
 * Product Rule 3: photo, name, vehicle, colour and plate are all present and
 * legible before boarding. `emphasiseVehicle` raises the vehicle details when
 * the driver is nearby, which is the moment the passenger needs to identify
 * the car in a crowded car park.
 */
export function DriverCard({
  driver,
  emphasiseVehicle = false,
  showContact = true,
  className,
}: {
  driver: Driver;
  emphasiseVehicle?: boolean;
  showContact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3.5", className)}>
      <div className="flex items-center gap-3.5">
        <Avatar
          name={driver.fullName}
          src={driver.avatarUrl}
          size="lg"
          verified
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="type-card-title text-[1.0625rem] text-ink">
              {shortName(driver.fullName)}
            </p>
            <VerifiedBadge label="Verified Driver" />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <RatingValue value={driver.rating} />
            <span className="text-ink-muted" aria-hidden>
              ·
            </span>
            <span className="type-meta text-ink-secondary">
              {driver.totalTrips} trips
            </span>
            <StatusChip tone={TRACK_TONE[driver.track]}>
              {TRACK_LABEL[driver.track]}
            </StatusChip>
          </div>
        </div>

        {showContact ? (
          <IconButton
            icon={Phone}
            label={`Call ${shortName(driver.fullName)}`}
            variant="secondary"
            size="lg"
            className="shrink-0"
          />
        ) : null}
      </div>

      {/* Vehicle identification */}
      <motion.div
        animate={
          emphasiseVehicle
            ? { scale: [1, 1.015, 1], borderColor: "var(--kx-gold-500)" }
            : { scale: 1 }
        }
        transition={
          emphasiseVehicle
            ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
            : transitions.card
        }
        className={cn(
          // Uneven tracks: the model needs the most room, the plate must never
          // truncate — it's what the passenger matches against the car.
          "grid grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)_minmax(0,1.1fr)] gap-3 rounded-[var(--kx-radius-md)] border p-3.5",
          emphasiseVehicle
            ? "border-gold-500 bg-gold-50/70 dark:bg-gold-500/10"
            : "border-line bg-surface-nested",
        )}
      >
        <div className="min-w-0">
          <p className="type-micro text-ink-muted">Vehicle</p>
          <p className="type-meta mt-1 truncate font-semibold text-ink">
            {driver.vehicle.make} {driver.vehicle.model}
          </p>
        </div>
        <div className="min-w-0">
          <p className="type-micro text-ink-muted">Colour</p>
          <p className="type-meta mt-1 truncate font-semibold text-ink">
            {driver.vehicle.colour}
          </p>
        </div>
        <div className="min-w-0">
          <p className="type-micro text-ink-muted">Plate</p>
          <p className="type-numeric type-meta mt-1 truncate font-semibold text-ink">
            {driver.vehicle.plateNumber}
          </p>
        </div>
      </motion.div>

      {driver.vehicle.verified ? (
        <p className="type-meta flex items-center gap-1.5 text-ink-muted">
          <ShieldCheck
            className="size-3.5 shrink-0 text-forest-600 dark:text-gold-400"
            strokeWidth={2}
            aria-hidden
          />
          This vehicle has passed a physical inspection.
        </p>
      ) : null}
    </div>
  );
}

/** The searching-state placeholder that the driver card replaces on match. */
export function DriverCardSearching({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3.5", className)}>
      <span className="relative inline-flex size-14 shrink-0 items-center justify-center">
        <span
          className="absolute inset-0 rounded-full bg-gold-500/20"
          style={{ animation: "kx-pulse-ring 2.2s ease-out infinite" }}
          aria-hidden
        />
        <span className="relative inline-flex size-14 items-center justify-center rounded-full bg-surface-nested ring-1 ring-line">
          <ShieldCheck className="size-6 text-ink-muted" strokeWidth={1.6} aria-hidden />
        </span>
      </span>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="kx-skeleton h-4 w-36 rounded-full" />
        <div className="kx-skeleton h-3 w-24 rounded-full" />
      </div>
    </div>
  );
}
