"use client";

import { motion } from "motion/react";
import { Check, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { MAX_SHARED_PASSENGERS } from "@/types/enums";
import { seatsRemaining } from "@/lib/state-machines";
import { transitions } from "@/lib/motion";

export interface SeatOccupant {
  seatIndex: 1 | 2 | 3;
  name: string;
}

/**
 * Top-down seat view for shared rides. Three passenger seats, never more —
 * the component cannot render a fourth.
 */
export function SeatMap({
  occupants,
  className,
  showSummary = true,
}: {
  occupants: SeatOccupant[];
  className?: string;
  showSummary?: boolean;
}) {
  const filled = Math.min(occupants.length, MAX_SHARED_PASSENGERS);
  const remaining = seatsRemaining(filled);

  const seatFor = (index: 1 | 2 | 3) =>
    occupants.find((occupant) => occupant.seatIndex === index);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="rounded-[var(--kx-radius-lg)] border border-line bg-surface-nested p-4">
        <p className="type-micro mb-3 text-center text-ink-muted">Front</p>

        <div className="grid grid-cols-2 gap-2.5">
          <SeatTile driver />
          <Seat index={1} occupant={seatFor(1)} />
        </div>

        <p className="type-micro mt-4 mb-3 text-center text-ink-muted">Back</p>

        <div className="grid grid-cols-2 gap-2.5">
          <Seat index={2} occupant={seatFor(2)} />
          <Seat index={3} occupant={seatFor(3)} />
        </div>
      </div>

      {showSummary ? (
        <p className="type-meta text-center text-ink-secondary">
          <span className="type-numeric font-semibold text-ink">
            {filled} of {MAX_SHARED_PASSENGERS}
          </span>{" "}
          seats filled
          {remaining > 0 ? (
            <span className="text-ink-muted">
              {" "}
              · {remaining} available
            </span>
          ) : (
            <span className="text-ink-muted"> · ride full</span>
          )}
        </p>
      ) : null}
    </div>
  );
}

function Seat({
  index,
  occupant,
}: {
  index: 1 | 2 | 3;
  occupant?: SeatOccupant;
}) {
  return (
    <motion.div
      layout
      transition={transitions.springGentle}
      className={cn(
        "flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-[var(--kx-radius-md)] border px-2 py-3 text-center",
        occupant
          ? "border-forest-300/60 bg-forest-50 dark:border-forest-500/30 dark:bg-forest-500/12"
          : "border-dashed border-line-strong bg-surface",
      )}
    >
      {occupant ? (
        <>
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-forest-600 text-white dark:bg-gold-500 dark:text-forest-950">
            <Check className="size-3" strokeWidth={3} aria-hidden />
          </span>
          <p className="type-meta truncate font-medium text-ink">{occupant.name}</p>
        </>
      ) : (
        <>
          <UserRound className="size-4 text-ink-muted" strokeWidth={1.6} aria-hidden />
          <p className="type-meta text-ink-muted">Seat {index} · Available</p>
        </>
      )}
    </motion.div>
  );
}

function SeatTile({ driver }: { driver?: boolean }) {
  return (
    <div className="flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-[var(--kx-radius-md)] border border-line bg-surface px-2 py-3 text-center">
      <span className="inline-flex size-5 items-center justify-center rounded-full bg-surface-nested text-ink-secondary">
        <UserRound className="size-3" strokeWidth={2} aria-hidden />
      </span>
      <p className="type-meta font-medium text-ink-secondary">
        {driver ? "Driver" : "—"}
      </p>
    </div>
  );
}
