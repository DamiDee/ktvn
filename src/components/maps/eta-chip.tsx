"use client";

import { motion } from "motion/react";
import { Clock, Navigation } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDistanceKm, formatEta } from "@/lib/format";

/** Floating ETA readout shown over the map. */
export function EtaChip({
  minutes,
  distanceKm,
  label,
  className,
}: {
  minutes: number;
  distanceKm?: number;
  label?: string;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "surface-glass inline-flex items-center gap-3 rounded-full py-2 pr-4 pl-3",
        className,
      )}
    >
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-gold-500/15 text-gold-700 dark:text-gold-300">
        <Clock className="size-4" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="type-micro text-ink-muted">{label ?? "ETA"}</p>
        <p className="type-numeric text-[0.9375rem] font-semibold text-ink">
          {formatEta(minutes)}
          {distanceKm !== undefined ? (
            <span className="ml-1.5 font-normal text-ink-muted">
              · {formatDistanceKm(distanceKm)}
            </span>
          ) : null}
        </p>
      </div>
    </motion.div>
  );
}

/** Recenter control. */
export function RecenterButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Recentre map"
      className={cn(
        "surface-glass inline-flex size-11 items-center justify-center rounded-full text-ink transition-transform duration-[165ms] hover:-translate-y-px active:scale-95",
        className,
      )}
    >
      <Navigation className="size-4.5" strokeWidth={1.8} aria-hidden />
    </button>
  );
}
