"use client";

import { motion } from "motion/react";
import { Users } from "lucide-react";
import { SeatMap } from "@/components/rides/seat-map";
import { formatNaira } from "@/lib/format";
import { quoteFare } from "@/services/ride-service";
import { cn } from "@/lib/cn";
import { viewportOnce } from "@/lib/motion";
import { Reveal } from "./section";

const EXAMPLE_FARE = quoteFare(19.1, 1).routeFare;

/**
 * Illustrates how a shared fare divides. This is professional-track only —
 * volunteer shared rides carry no fare panel at all.
 */
export function SharedRidesSection() {
  const splits = [3, 2, 1].map((riders) => ({
    riders,
    each: Math.round(EXAMPLE_FARE / riders / 50) * 50,
  }));

  return (
    <div className="mt-12 grid gap-6 sm:mt-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:items-center">
      <Reveal>
        <SeatMap
          occupants={[
            { seatIndex: 1, name: "Grace" },
            { seatIndex: 2, name: "Daniel" },
          ]}
        />
      </Reveal>

      <div className="space-y-5">
        <Reveal delay={0.1}>
          <div className="rounded-[var(--kx-radius-xl)] border border-line bg-surface p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="type-micro text-ink-muted">Route fare</p>
                <p className="type-numeric mt-1 text-[1.75rem] leading-none font-semibold text-ink">
                  {formatNaira(EXAMPLE_FARE)}
                </p>
              </div>
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-lilac-500/14 text-lilac-700 dark:text-lilac-300">
                <Users className="size-5" strokeWidth={1.7} aria-hidden />
              </span>
            </div>

            <div className="mt-5 space-y-2">
              {splits.map((split, index) => (
                <motion.div
                  key={split.riders}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={viewportOnce}
                  transition={{ duration: 0.42, delay: 0.1 + index * 0.09 }}
                  className={cn(
                    "flex items-center justify-between rounded-[var(--kx-radius-md)] px-4 py-3",
                    split.riders === 2
                      ? "bg-lilac-50 ring-1 ring-inset ring-lilac-200 dark:bg-lilac-500/10 dark:ring-lilac-700/35"
                      : "bg-surface-nested",
                  )}
                >
                  <span className="type-body text-ink-secondary">
                    {split.riders} {split.riders === 1 ? "rider" : "riders"}
                  </span>
                  <span className="type-numeric text-[0.9375rem] font-semibold text-ink">
                    {formatNaira(split.each)} each
                  </span>
                </motion.div>
              ))}
            </div>

            <p className="type-meta mt-4 text-ink-muted">
              The fare is fixed for the route. The more riders travelling the
              same way, the smaller each share — up to three passengers.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="type-meta text-ink-muted">
            Volunteer shared rides work the same way for seats and tracking,
            without any fare or payment step.
          </p>
        </Reveal>
      </div>
    </div>
  );
}
