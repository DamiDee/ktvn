"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Navigation } from "lucide-react";
import { formatMinutes } from "@/lib/format";
import { useSessionStore } from "@/stores/session-store";

/**
 * Persistent indicator shown when a ride is in progress and the user has
 * navigated away from the ride screen. Clicking returns to the map.
 */
export function ActiveRideIndicator() {
  const pathname = usePathname();
  const rideId = useSessionStore((state) => state.activeRideId);
  const minutes = useSessionStore((state) => state.activeRideMinutesRemaining);

  // The live ride always lives at one route; historical rides have their own.
  const rideHref = rideId ? "/passenger/trip" : null;
  // Hide it while the ride screen itself is open.
  const onRideScreen = rideHref ? pathname.startsWith(rideHref) : false;
  const visible = Boolean(rideId) && !onRideScreen;

  return (
    <AnimatePresence>
      {visible && rideHref ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed inset-x-4 bottom-[4.5rem] z-40 mx-auto max-w-md lg:inset-x-auto lg:right-6 lg:bottom-6 lg:left-auto"
        >
          <Link
            href={rideHref}
            className="surface-glass flex items-center gap-3 rounded-full py-2.5 pr-3 pl-4 transition-transform duration-[165ms] hover:-translate-y-0.5"
          >
            <span className="relative flex size-2.5 shrink-0">
              <span
                className="absolute inline-flex size-full rounded-full bg-success-500"
                style={{ animation: "kx-pulse-ring 2s ease-out infinite" }}
                aria-hidden
              />
              <span className="relative inline-flex size-2.5 rounded-full bg-success-500" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[0.875rem] font-medium text-ink">
                Ride in progress
              </p>
              {minutes !== null ? (
                <p className="type-meta type-numeric text-ink-secondary">
                  {formatMinutes(minutes)} remaining
                </p>
              ) : null}
            </div>

            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--kx-text)_7%,transparent)] text-ink-secondary">
              <Navigation className="size-3.5" strokeWidth={2} aria-hidden />
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
          </Link>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
