"use client";

import { AnimatePresence, motion } from "motion/react";
import { HandHeart, Info, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { collapseVariants } from "@/lib/motion";
import { formatNaira } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { DriverTrack, RideType } from "@/types/enums";
import type { FareQuoteLike } from "@/types/models";

/**
 * The fare region of the request card.
 *
 * Product Rule 1 is structural here: on the volunteer track this renders a
 * service note and *no* monetary component at all. There is no `₦0` branch to
 * fall into, because the volunteer path never receives a fare value.
 */
export function FarePanel({
  track,
  rideType,
  fare,
  loading = false,
  className,
}: {
  track: DriverTrack;
  rideType: RideType;
  /** Undefined/null on the volunteer track by construction. */
  fare: FareQuoteLike | null;
  loading?: boolean;
  className?: string;
}) {
  const isVolunteer = track === DriverTrack.VOLUNTEER;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {isVolunteer ? (
        <motion.div
          key="volunteer"
          variants={collapseVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={cn("overflow-hidden", className)}
        >
          <div className="flex items-start gap-3 rounded-[var(--kx-radius-md)] border border-gold-200/70 bg-gold-50/60 p-4 dark:border-gold-700/30 dark:bg-gold-500/8">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-gold-500/18 text-gold-700 dark:text-gold-300">
              <HandHeart className="size-4" strokeWidth={1.8} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="type-body font-medium text-ink">
                Volunteer ride · No payment required
              </p>
              <p className="type-meta mt-0.5 text-ink-secondary">
                A verified member is offering a seat they already have.
              </p>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="professional"
          variants={collapseVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={cn("overflow-hidden", className)}
        >
          <div className="rounded-[var(--kx-radius-md)] border border-lilac-200/70 bg-lilac-50/50 p-4 dark:border-lilac-700/30 dark:bg-lilac-500/8">
            {loading || !fare ? (
              <div className="space-y-2.5">
                <Skeleton className="h-2.5 w-24 rounded-full" />
                <Skeleton className="h-7 w-32 rounded-lg" />
                <Skeleton className="h-3 w-44 rounded-full" />
              </div>
            ) : (
              <>
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="type-micro text-ink-muted">
                      {rideType === RideType.SHARED
                        ? "Estimated share"
                        : "Estimated fare"}
                    </p>
                    <p className="type-numeric mt-1 text-[1.75rem] leading-none font-semibold text-ink">
                      {formatNaira(
                        rideType === RideType.SHARED
                          ? fare.perRider
                          : fare.routeFare,
                      )}
                    </p>
                  </div>

                  {rideType === RideType.SHARED ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-lilac-500/14 px-2.5 py-1 text-[0.75rem] font-medium text-lilac-700 dark:text-lilac-200">
                      <Users className="size-3.5" strokeWidth={2} aria-hidden />
                      Up to 3 riders
                    </span>
                  ) : null}
                </div>

                {rideType === RideType.SHARED ? (
                  <div className="mt-4 space-y-1.5 border-t border-lilac-200/60 pt-3 dark:border-lilac-700/25">
                    <p className="type-micro mb-2 text-ink-muted">
                      Route fare {formatNaira(fare.routeFare)} · split by riders
                    </p>
                    {fare.breakdown.map((split) => (
                      <div
                        key={split.riders}
                        className="flex items-center justify-between"
                      >
                        <span className="type-meta text-ink-secondary">
                          {split.riders}{" "}
                          {split.riders === 1 ? "rider" : "riders"}
                        </span>
                        <span className="type-numeric type-meta font-semibold text-ink">
                          {formatNaira(split.each)} each
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <p className="type-meta mt-3 flex items-start gap-1.5 text-ink-muted">
                  <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                  The fare is agreed before you travel and won&rsquo;t change
                  during the journey.
                </p>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
