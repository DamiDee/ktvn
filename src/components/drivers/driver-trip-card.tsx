import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { AvatarStack } from "@/components/ui/avatar";
import { StatusBadge, StatusChip } from "@/components/ui/badge";
import {
  PAYMENT_PRESENTATION,
  RIDE_STATUS_PRESENTATION,
  RIDE_TYPE_LABEL,
  TRACK_LABEL,
  TRACK_TONE,
} from "@/constants/status-presentation";
import { formatDateTime, formatNaira, pluralise } from "@/lib/format";
import { DriverTrack, PaymentStatus } from "@/types/enums";
import type { Ride } from "@/types/models";

/**
 * A trip from the driver's side.
 *
 * Volunteer trips have no `fare`, so the earned amount simply isn't rendered
 * — the professional branch is the only one that can print currency.
 */
export function DriverTripCard({
  trip,
  href,
  className,
}: {
  trip: Ride;
  href?: string;
  className?: string;
}) {
  const isProfessional = trip.track === DriverTrack.PROFESSIONAL;
  const passengerCount = trip.passengers.length;

  // Per-passenger settlement, professional shared trips only.
  const unpaid = trip.passengers.filter(
    (passenger) => passenger.paymentStatus === PaymentStatus.PENDING,
  ).length;

  const body = (
    <div
      className={cn(
        "rounded-[var(--kx-radius-lg)] border border-line bg-surface p-4 sm:p-5",
        href &&
          "transition-[transform,box-shadow,border-color] duration-[250ms] ease-[var(--kx-ease-standard)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="type-numeric type-meta text-ink-muted">
              {trip.reference}
            </span>
            <span className="type-meta text-ink-muted" aria-hidden>
              ·
            </span>
            <span className="type-meta text-ink-muted">
              {formatDateTime(trip.requestedAt)}
            </span>
          </div>

          <p className="type-card-title mt-1.5 truncate text-ink">
            {trip.pickup.label} → {trip.destination.label}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <StatusChip tone={TRACK_TONE[trip.track]}>
              {TRACK_LABEL[trip.track]}
            </StatusChip>
            <StatusChip tone="neutral">
              {RIDE_TYPE_LABEL[trip.rideType]}
            </StatusChip>
            <StatusChip tone="neutral" icon={Users}>
              {passengerCount} {pluralise(passengerCount, "passenger")}
            </StatusChip>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge presentation={RIDE_STATUS_PRESENTATION[trip.status]} />

          {isProfessional && trip.fare !== undefined ? (
            <span className="type-numeric text-[0.9375rem] font-semibold text-ink">
              {formatNaira(trip.fare)}
            </span>
          ) : trip.track === DriverTrack.VOLUNTEER ? (
            <span className="type-meta text-ink-muted">Given in service</span>
          ) : null}
        </div>
      </div>

      {/* Passengers */}
      {passengerCount > 0 ? (
        <div className="mt-4 flex items-center gap-3 border-t border-line pt-3.5">
          <AvatarStack
            people={trip.passengers.map((passenger) => ({
              name: passenger.name,
              avatarUrl: passenger.avatarUrl,
            }))}
            size="xs"
          />
          <span className="type-meta min-w-0 truncate text-ink-secondary">
            {trip.passengers.map((passenger) => passenger.name.split(" ")[0]).join(", ")}
          </span>

          {/* Product Rule 1: settlement chips exist only on the paid track. */}
          {isProfessional && unpaid > 0 ? (
            <StatusChip
              tone={PAYMENT_PRESENTATION[PaymentStatus.PENDING].tone}
              className="ml-auto shrink-0"
            >
              {unpaid} unpaid
            </StatusChip>
          ) : null}

          {href ? (
            <ArrowRight
              className="ml-auto size-4 shrink-0 text-ink-muted"
              strokeWidth={1.8}
              aria-hidden
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (!href) return body;

  return (
    <Link href={href} className="block">
      {body}
    </Link>
  );
}
