import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, StatusChip } from "@/components/ui/badge";
import {
  RIDE_STATUS_PRESENTATION,
  RIDE_TYPE_LABEL,
  TRACK_LABEL,
  TRACK_TONE,
} from "@/constants/status-presentation";
import { formatDateTime, formatNaira, shortName } from "@/lib/format";
import { DriverTrack } from "@/types/enums";
import type { Ride } from "@/types/models";

/**
 * Ride summary row.
 *
 * Money is rendered only when the ride is on the professional track — a
 * volunteer ride has no fare field at all, so nothing here can print ₦0.
 */
export function RideCard({
  ride,
  href,
  className,
}: {
  ride: Ride;
  href?: string;
  className?: string;
}) {
  const isProfessional = ride.track === DriverTrack.PROFESSIONAL;
  const userShare = ride.payment?.userShare;

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
              {ride.reference}
            </span>
            <span className="type-meta text-ink-muted" aria-hidden>
              ·
            </span>
            <span className="type-meta text-ink-muted">
              {formatDateTime(ride.requestedAt)}
            </span>
          </div>

          <p className="type-card-title mt-1.5 truncate text-ink">
            {ride.pickup.label} → {ride.destination.label}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <StatusChip tone={TRACK_TONE[ride.track]}>
              {TRACK_LABEL[ride.track]}
            </StatusChip>
            <StatusChip tone="neutral">{RIDE_TYPE_LABEL[ride.rideType]}</StatusChip>
            {ride.ratingGiven ? (
              <StatusChip tone="neutral" icon={Star}>
                {ride.ratingGiven.stars}.0
              </StatusChip>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge presentation={RIDE_STATUS_PRESENTATION[ride.status]} />

          {/* Product Rule 1: money only ever appears on the professional track. */}
          {isProfessional && userShare !== undefined ? (
            <span className="type-numeric text-[0.9375rem] font-semibold text-ink">
              {formatNaira(userShare)}
            </span>
          ) : ride.track === DriverTrack.VOLUNTEER ? (
            <span className="type-meta text-ink-muted">No payment required</span>
          ) : null}
        </div>
      </div>

      {ride.driver ? (
        <div className="mt-4 flex items-center gap-2.5 border-t border-line pt-3.5">
          <Avatar
            name={ride.driver.fullName}
            src={ride.driver.avatarUrl}
            size="xs"
            verified
          />
          <span className="type-meta truncate text-ink-secondary">
            {shortName(ride.driver.fullName)} ·{" "}
            {ride.driver.vehicle.colour} {ride.driver.vehicle.make}{" "}
            {ride.driver.vehicle.model}
          </span>
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
