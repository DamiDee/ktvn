"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { formatDistance, formatDuration, formatMoney, firstName } from "../domain/format";
import type { Ride } from "../domain/types";
import { PinCharacter, RatingFace } from "../components/characters";
import { RideSheet } from "../components/ride-sheet";
import { MetricRow, RouteStops } from "../components/ride-ui";
import { usePassengerStore } from "../state/passenger-store";
import type { SheetHostProps } from "./panel-types";

const PRAISE = ["Safe driving", "Clean vehicle", "Friendly", "Great navigation", "Professional", "On time"];
const CONCERNS = ["Late pickup", "Unsafe driving", "Vehicle not clean", "Took a long route", "Rude"];
const STAR_WORDS = ["", "Not good", "Could be better", "Okay", "Good", "Excellent"];

/**
 * TRIP_COMPLETED → rating. The peak-end moment: a calm "you've arrived", a
 * clear receipt, then a rating that responds as you choose.
 */
export function CompletionPanel({ ride, onCoverChange, bottomOffset }: SheetHostProps & { ride: Ride }) {
  const rateRide = usePassengerStore((store) => store.rateRide);
  const dismissRide = usePassengerStore((store) => store.dismissRide);
  const pending = usePassengerStore((store) => store.session.pending);
  const failed = usePassengerStore((store) => store.session.error?.action === "rate");
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [thanked, setThanked] = useState(Boolean(ride.rating));

  const driverName = ride.driver ? firstName(ride.driver.displayName) : "your driver";
  const duration =
    ride.timestamps.startedAt && ride.timestamps.completedAt
      ? (Date.parse(ride.timestamps.completedAt) - Date.parse(ride.timestamps.startedAt)) / 1000
      : ride.route.durationSeconds;
  const paymentFailed = ride.payment.status === "failed";
  const chips = stars >= 4 ? PRAISE : stars > 0 ? CONCERNS : [];

  async function submit() {
    const ok = await rateRide({ stars, tags, comment: comment.trim() || undefined });
    if (ok) setThanked(true);
  }

  return (
    <RideSheet
      label="Trip complete"
      collapsible={false}
      onCoverChange={onCoverChange}
      bottomOffset={bottomOffset}
      resetKey="complete"
      maxHeight="78dvh"
      peek={
        <div className="flex items-center gap-4 pt-1">
          <PinCharacter mood="happy" size={52} label="Trip complete" />
          <div className="min-w-0">
            <h2 className="ride-heading-lg">You&apos;ve arrived</h2>
            <p className="ride-body-sm truncate text-[var(--text-secondary)]">{ride.destination.name}</p>
          </div>
        </div>
      }
      footer={
        thanked ? (
          <Button size="xl" block pill onClick={dismissRide}>
            Done
          </Button>
        ) : (
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button variant="ghost" size="lg" pill onClick={dismissRide}>
              Skip
            </Button>
            <Button size="lg" pill disabled={stars === 0} loading={pending === "rate"} loadingLabel="Sending" onClick={() => void submit()}>
              Rate {driverName}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-5 pb-3">
        {paymentFailed ? (
          <div role="alert" className="rounded-[var(--ride-radius-md)] bg-[var(--kx-danger-50)] p-4 text-[var(--kx-danger-700)] dark:bg-[color-mix(in_srgb,var(--kx-danger-500)_16%,transparent)] dark:text-red-200">
            <p className="font-semibold">Payment didn&apos;t go through</p>
            <p className="ride-body-sm">
              {formatMoney(ride.fare.total)} is still due on {ride.payment.methodLabel}. You can settle it with your driver or from Activity once payments are enabled.
            </p>
          </div>
        ) : null}

        <div className="rounded-[var(--ride-radius-lg)] border border-[var(--border-subtle)] p-4">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="ride-label">{paymentFailed ? "Amount due" : `Paid · ${ride.payment.methodLabel}`}</p>
            <p className="ride-num text-[1.5rem] font-semibold tracking-[-0.03em]">{formatMoney(ride.fare.total)}</p>
          </div>
          <MetricRow
            items={[
              { label: "Distance", value: formatDistance(ride.route.distanceMeters) },
              { label: "Time", value: formatDuration(duration) },
              { label: "Ride", value: ride.option.name },
            ]}
          />
          <div className="mt-4">
            <RouteStops pickup={ride.pickup} destination={ride.destination} compact />
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {thanked ? (
            <motion.div key="thanks" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-2 text-center" role="status">
              <RatingFace stars={ride.rating?.stars ?? (stars || 5)} size={64} />
              <p className="ride-heading-md mt-2">Thanks for rating {driverName}</p>
              <p className="ride-body-sm text-[var(--text-secondary)]">Your feedback keeps the network safe and kind.</p>
            </motion.div>
          ) : (
            <motion.section key="rate" exit={{ opacity: 0 }} aria-labelledby="rate-heading" className="flex flex-col items-center text-center">
              <RatingFace stars={stars} />
              <h3 id="rate-heading" className="ride-heading-md mt-2">
                How was your ride with {driverName}?
              </h3>
              <div role="radiogroup" aria-label="Rating" className="mt-3 flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={stars === value}
                    aria-label={`${value} star${value > 1 ? "s" : ""}, ${STAR_WORDS[value]}`}
                    onClick={() => {
                      setStars(value);
                      setTags([]);
                    }}
                    className="ride-press flex size-12 items-center justify-center rounded-full"
                  >
                    <motion.span animate={{ scale: value <= stars ? 1.08 : 1 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}>
                      <Star
                        className={cn("size-8 transition-colors", value <= stars ? "fill-[var(--kx-gold-500)] text-[var(--kx-gold-500)]" : "text-[var(--border-strong)]")}
                        strokeWidth={1.6}
                        aria-hidden
                      />
                    </motion.span>
                  </button>
                ))}
              </div>
              <p className="ride-body-sm h-5 font-semibold text-[var(--text-secondary)]" aria-live="polite">
                {STAR_WORDS[stars]}
              </p>

              {chips.length ? (
                <div className="mt-3 w-full text-left">
                  <p className="ride-label mb-2">{stars >= 4 ? "What went well?" : "What could be better?"}</p>
                  <div className="flex flex-wrap gap-2">
                    {chips.map((chip) => {
                      const on = tags.includes(chip);
                      return (
                        <button
                          key={chip}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setTags((current) => (on ? current.filter((tag) => tag !== chip) : [...current, chip]))}
                          className={cn(
                            "ride-press h-10 rounded-full border px-4 text-[0.875rem] font-medium",
                            on ? "border-[var(--ride-primary)] bg-[color-mix(in_srgb,var(--ride-primary)_12%,transparent)] font-semibold" : "border-[var(--border-subtle)]",
                          )}
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                  <label className="mt-4 block">
                    <span className="ride-body-sm mb-1.5 block font-medium">Add a comment (optional)</span>
                    <textarea
                      value={comment}
                      onChange={(event) => setComment(event.target.value.slice(0, 500))}
                      rows={2}
                      className="w-full rounded-[var(--ride-radius-md)] border border-[var(--border-strong)] bg-[var(--surface-primary)] p-3 text-[0.9375rem] focus:border-[var(--ride-primary)] focus:outline-none"
                    />
                  </label>
                </div>
              ) : null}
              {failed ? (
                <p role="alert" className="ride-body-sm mt-2 text-[var(--ride-danger)]">
                  Your rating didn&apos;t send. Try again.
                </p>
              ) : null}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </RideSheet>
  );
}
