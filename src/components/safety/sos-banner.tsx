"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import { SOS_PRESENTATION, TRACK_LABEL } from "@/constants/status-presentation";
import type { SOSAlert } from "@/types/models";
import { DriverTrack } from "@/types/enums";

/**
 * Persistent admin SOS banner. Pulses gently — never flashes — and always
 * carries text alongside the colour.
 */
export function SosBanner({
  alert,
  track = DriverTrack.VOLUNTEER,
  className,
}: {
  alert: SOSAlert;
  track?: DriverTrack;
  className?: string;
}) {
  const presentation = SOS_PRESENTATION[alert.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      aria-live="assertive"
      className={cn(
        "relative overflow-hidden rounded-[var(--kx-radius-lg)] border border-sos-500/35 bg-sos-50 p-4 sm:p-5 dark:bg-sos-500/12",
        className,
      )}
    >
      {/* Gentle breathing wash rather than a flash */}
      <motion.span
        animate={{ opacity: [0.05, 0.14, 0.05] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-0 bg-sos-500"
        aria-hidden
      />

      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-sos-500 text-white sm:size-10">
            <ShieldAlert className="size-4.5 sm:size-5" strokeWidth={2} aria-hidden />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <p className="type-micro text-sos-700 dark:text-red-200">SOS alert</p>
              <span className="type-numeric text-[0.8125rem] font-semibold text-ink">
                Ride {alert.rideReference}
              </span>
              <span className="type-meta text-ink-secondary">
                Track {track === DriverTrack.VOLUNTEER ? "A" : "B"} ·{" "}
                {TRACK_LABEL[track]}
              </span>
            </div>

            <p className="type-body mt-1 font-medium text-ink">
              {presentation.detail ?? presentation.label}
            </p>
            <p className="type-meta mt-1 text-ink-secondary">
              Raised by {alert.raisedByName} ·{" "}
              {formatRelativeTime(alert.raisedAt)} · Live location shared
            </p>
          </div>
        </div>

        <Link
          href={`/admin/live-rides/${alert.rideId}`}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-sos-500 px-5 text-[0.875rem] font-semibold text-white transition-colors hover:bg-sos-600"
        >
          Open Ride
          <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </motion.div>
  );
}
