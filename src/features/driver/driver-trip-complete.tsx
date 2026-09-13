"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Clock, Heart, Receipt as ReceiptIcon, Route as RouteIcon, Users } from "lucide-react";
import { Card, CardHeader, NestedTile } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { AnimatedCheck, StatusChip } from "@/components/ui/badge";
import { CountUp } from "@/components/ui/stats-card";
import { PAYMENT_PRESENTATION } from "@/constants/status-presentation";
import { DriverTrack, PaymentStatus, RideType } from "@/types/enums";
import { formatMinutes, formatNaira, pluralise } from "@/lib/format";
import type { Driver, Ride } from "@/types/models";

/**
 * The end of a driver's journey.
 *
 * The two tracks end differently on purpose: a volunteer is thanked and shown
 * what their service adds up to, a professional is shown what the trip earned
 * and where that payment stands. Neither ever sees the other's version
 * (Product Rules 1 and 7).
 */
export function DriverTripComplete({
  trip,
  driver,
}: {
  trip: Ride;
  driver: Driver;
}) {
  const router = useRouter();
  const volunteer = trip.track === DriverTrack.VOLUNTEER;
  const riders = trip.passengers.length;
  const minutes = trip.durationMinutes ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center text-center"
      >
        <AnimatedCheck size={56} />
        <h1 className="type-page-title mt-5 text-ink">Ride completed</h1>
        <p className="type-body mt-2 text-ink-secondary">
          {volunteer
            ? "Thank you for serving."
            : `${formatNaira(trip.fare ?? 0)} earned on this trip.`}
        </p>
      </motion.div>

      {volunteer ? (
        <VolunteerSummary driver={driver} riders={riders} minutes={minutes} />
      ) : (
        <ProfessionalSummary trip={trip} riders={riders} minutes={minutes} />
      )}

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse">
        <ButtonLink
          href="/driver"
          variant="primary"
          size="lg"
          className="sm:flex-1"
        >
          Back to your dashboard
        </ButtonLink>
        <Button
          variant="secondary"
          size="lg"
          className="sm:flex-1"
          onClick={() => router.push("/driver/trips")}
        >
          See your trips
        </Button>
      </div>
    </div>
  );
}

function VolunteerSummary({
  driver,
  riders,
  minutes,
}: {
  driver: Driver;
  riders: number;
  minutes: number;
}) {
  // The hours this trip adds, rounded the way the service record counts them.
  const addedHours = Math.max(1, Math.round(minutes / 60));
  const service = driver.service;

  return (
    <Card radius="xl" className="mt-7">
      <CardHeader
        eyebrow="Volunteer service"
        title="Your service record"
        description="Updated with this journey."
      />

      <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3">
        <Stat
          icon={Clock}
          label="Service hours"
          value={(service?.serviceHours ?? 0) + addedHours}
          note={`+${addedHours}`}
        />
        <Stat
          icon={RouteIcon}
          label="Volunteer trips"
          value={(service?.volunteerTrips ?? 0) + 1}
          note="+1"
        />
        <Stat
          icon={Users}
          label="People carried"
          value={(service?.passengersServed ?? 0) + riders}
          note={`+${riders}`}
        />
      </div>

      <NestedTile className="mt-4 flex items-start gap-3">
        <Heart
          className="mt-0.5 size-4 shrink-0 text-gold-600 dark:text-gold-400"
          strokeWidth={1.9}
          aria-hidden
        />
        <p className="type-meta text-ink-secondary">
          You carried {riders} {pluralise(riders, "member")} over{" "}
          {formatMinutes(minutes)}. Nothing was charged for this journey, and
          nothing is owed to you.
        </p>
      </NestedTile>
    </Card>
  );
}

function ProfessionalSummary({
  trip,
  riders,
  minutes,
}: {
  trip: Ride;
  riders: number;
  minutes: number;
}) {
  const shared = trip.rideType === RideType.SHARED;
  const settled = trip.passengers.filter(
    (rider) => rider.paymentStatus === PaymentStatus.PAID,
  ).length;
  const outstanding = riders - settled;

  return (
    <Card radius="xl" className="mt-7">
      <CardHeader
        eyebrow="Professional track"
        title="What this trip earned"
        description="A record of the journey, not a balance held for you."
      />

      <NestedTile className="mt-5 text-center">
        <p className="type-micro text-ink-muted">Trip total</p>
        <p className="type-numeric mt-1.5 text-[1.75rem] leading-none font-semibold text-ink">
          {formatNaira(trip.fare ?? 0)}
        </p>
        <p className="type-meta mt-1.5 text-ink-muted">
          {riders} {pluralise(riders, "rider")} · {formatMinutes(minutes)}
        </p>
      </NestedTile>

      {shared ? (
        <ul className="mt-4 space-y-2">
          {trip.passengers.map((rider) => (
            <li
              key={rider.id}
              className="flex items-center justify-between gap-3 rounded-[var(--kx-radius-md)] bg-surface-nested px-4 py-3"
            >
              <span className="type-meta min-w-0 truncate text-ink-secondary">
                {rider.name}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {rider.fareShare !== undefined ? (
                  <span className="type-numeric type-meta font-semibold text-ink">
                    {formatNaira(rider.fareShare)}
                  </span>
                ) : null}
                <StatusChip
                  tone={PAYMENT_PRESENTATION[rider.paymentStatus].tone}
                >
                  {PAYMENT_PRESENTATION[rider.paymentStatus].label}
                </StatusChip>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <NestedTile className="mt-4 flex items-start gap-3">
        <ReceiptIcon
          className="mt-0.5 size-4 shrink-0 text-ink-muted"
          strokeWidth={1.8}
          aria-hidden
        />
        <p className="type-meta text-ink-secondary">
          {outstanding === 0
            ? "Every share is paid. Receipts are issued to each rider."
            : `${outstanding} ${pluralise(outstanding, "share")} still pending. The network chases payment; you don't collect anything yourself.`}
        </p>
      </NestedTile>

      <ButtonLink
        href="/driver/professional/receipts"
        variant="secondary"
        size="md"
        block
        className="mt-4"
      >
        View receipts
      </ButtonLink>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <NestedTile className="text-center">
      <Icon
        className="mx-auto size-4 text-ink-muted"
        strokeWidth={1.7}
        aria-hidden
      />
      <p className="type-numeric mt-2 text-[1.25rem] leading-none font-semibold text-ink">
        <CountUp value={value} />
      </p>
      <p className="type-micro mt-1.5 text-ink-muted">{label}</p>
      <p className="type-meta mt-1 font-medium text-success-600 dark:text-success-400">
        {note}
      </p>
    </NestedTile>
  );
}
