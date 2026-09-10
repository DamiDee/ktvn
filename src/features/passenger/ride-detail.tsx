"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import { Card, CardHeader, NestedTile } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { StatusBadge, StatusChip } from "@/components/ui/badge";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { RatingValue } from "@/components/ui/rating";
import { ErrorState } from "@/components/ui/states";
import { PageLoader } from "@/components/ui/route-loader";
import { PageHeader } from "@/components/layout/app-shell";
import { MapCanvas } from "@/components/maps/map-canvas";
import { DriverCard } from "@/components/drivers/driver-card";
import { SeatMap } from "@/components/rides/seat-map";
import { RatingSheet } from "@/components/rides/rating-sheet";
import { PaymentPanel } from "@/components/payments/payment-panel";
import { ReceiptCard } from "@/components/payments/receipt-card";
import { queryKeys } from "@/constants/query-keys";
import { rideService } from "@/services";
import {
  RIDE_STATUS_PRESENTATION,
  RIDE_TYPE_LABEL,
  TRACK_LABEL,
  TRACK_TONE,
} from "@/constants/status-presentation";
import { DriverTrack, PaymentStatus, RideType } from "@/types/enums";
import { isPaymentSettled } from "@/lib/state-machines";
import {
  formatDateTime,
  formatDistanceKm,
  formatMinutes,
  shortName,
} from "@/lib/format";

/**
 * A single journey after the fact: route, driver, timeline, and — on the
 * professional track only — payment and receipt.
 */
export function RideDetail({ rideId }: { rideId: string }) {
  const [ratingOpen, setRatingOpen] = useState(false);

  const { data: ride, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.passenger.ride(rideId),
    queryFn: () => rideService.getRide(rideId),
  });

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);

  if (isLoading) return <PageLoader message="Loading your journey" />;

  if (isError || !ride) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          title="We couldn't find that journey."
          description="It may have been removed, or the link may be out of date."
          onRetry={() => refetch()}
          action={
            <ButtonLink
              href="/passenger/rides"
              variant="secondary"
              size="md"
              icon={ArrowLeft}
            >
              Back to your rides
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const isProfessional = ride.track === DriverTrack.PROFESSIONAL;
  const effectivePayment = paymentStatus ?? ride.payment?.status;
  const needsPayment =
    isProfessional &&
    ride.payment &&
    !isPaymentSettled(effectivePayment ?? PaymentStatus.PENDING);

  const timelineItems: TimelineItem[] = ride.events.map((event) => ({
    id: event.id,
    label: event.label,
    description: event.detail,
    meta: formatDateTime(event.at),
    state: "COMPLETE",
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/passenger/rides"
        className="kx-tap type-meta mb-4 inline-flex items-center gap-1.5 font-medium text-ink-secondary transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
        All rides
      </Link>

      <PageHeader
        eyebrow={
          <span className="type-numeric">
            Ride {ride.reference} · {formatDateTime(ride.requestedAt)}
          </span>
        }
        title={`${ride.pickup.label} → ${ride.destination.label}`}
        action={
          <StatusBadge
            presentation={RIDE_STATUS_PRESENTATION[ride.status]}
            size="md"
          />
        }
      />

      <div className="space-y-5">
        {/* Route map */}
        {ride.route ? (
          <Card radius="xl" padded={false} className="overflow-hidden">
            <MapCanvas
              className="h-[220px] w-full sm:h-[300px]"
              description={`The route travelled from ${ride.pickup.label} to ${ride.destination.label}.`}
              routes={[
                {
                  id: "route",
                  path: ride.route,
                  variant: "primary",
                  progress: 1,
                  animateDraw: true,
                },
              ]}
              markers={[
                { id: "pickup", position: ride.pickup, kind: "pickup" },
                {
                  id: "destination",
                  position: ride.destination,
                  kind: "destination",
                },
              ]}
            />
          </Card>
        ) : null}

        {/* Summary */}
        <Card radius="xl">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={TRACK_TONE[ride.track]}>
              {TRACK_LABEL[ride.track]}
            </StatusChip>
            <StatusChip tone="neutral">
              {RIDE_TYPE_LABEL[ride.rideType]}
            </StatusChip>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NestedTile>
              <p className="type-micro text-ink-muted">Distance</p>
              <p className="type-numeric mt-1 text-[0.9375rem] font-semibold text-ink">
                {ride.distanceKm ? formatDistanceKm(ride.distanceKm) : "—"}
              </p>
            </NestedTile>
            <NestedTile>
              <p className="type-micro text-ink-muted">Duration</p>
              <p className="type-numeric mt-1 text-[0.9375rem] font-semibold text-ink">
                {ride.durationMinutes ? formatMinutes(ride.durationMinutes) : "—"}
              </p>
            </NestedTile>
            <NestedTile className="col-span-2 sm:col-span-1">
              <p className="type-micro text-ink-muted">
                {isProfessional ? "Your share" : "Cost"}
              </p>
              <p className="type-numeric mt-1 text-[0.9375rem] font-semibold text-ink">
                {/* Product Rule 1: no amount, and no ₦0, on a volunteer ride. */}
                {isProfessional && ride.payment
                  ? new Intl.NumberFormat("en-NG", {
                      style: "currency",
                      currency: "NGN",
                      maximumFractionDigits: 0,
                    }).format(ride.payment.userShare)
                  : "No payment required"}
              </p>
            </NestedTile>
          </div>

          <div className="mt-4 space-y-2.5">
            <NestedTile className="flex items-start gap-3">
              <span
                className="mt-1 size-2.5 shrink-0 rounded-full border-2 border-forest-700 dark:border-gold-400"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="type-micro text-ink-muted">Pickup</p>
                <p className="type-body truncate font-medium text-ink">
                  {ride.pickup.label}
                </p>
                <p className="type-meta truncate text-ink-muted">
                  {ride.pickup.address}
                </p>
              </div>
            </NestedTile>

            <NestedTile className="flex items-start gap-3">
              <MapPin
                className="mt-0.5 size-4 shrink-0 text-forest-700 dark:text-gold-400"
                strokeWidth={2}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="type-micro text-ink-muted">Destination</p>
                <p className="type-body truncate font-medium text-ink">
                  {ride.destination.label}
                </p>
                <p className="type-meta truncate text-ink-muted">
                  {ride.destination.address}
                </p>
              </div>
            </NestedTile>
          </div>
        </Card>

        {/* Payment — professional track only */}
        {needsPayment && ride.payment ? (
          <div>
            <p className="type-micro mb-2.5 text-ink-muted">Payment</p>
            <PaymentPanel
              payment={ride.payment}
              rideType={ride.rideType}
              onSettled={setPaymentStatus}
            />
          </div>
        ) : null}

        {/* Driver */}
        {ride.driver ? (
          <Card radius="xl">
            <CardHeader title="Your driver" />
            <div className="mt-5">
              <DriverCard driver={ride.driver} showContact={false} />
            </div>

            {ride.ratingGiven ? (
              <NestedTile className="mt-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="type-meta text-ink-muted">You rated this ride</p>
                  {ride.ratingGiven.comment ? (
                    <p className="type-meta mt-0.5 truncate text-ink-secondary">
                      &ldquo;{ride.ratingGiven.comment}&rdquo;
                    </p>
                  ) : null}
                </div>
                <RatingValue value={ride.ratingGiven.stars} size="md" />
              </NestedTile>
            ) : (
              <Button
                variant="secondary"
                size="lg"
                block
                icon={Star}
                className="mt-4"
                onClick={() => setRatingOpen(true)}
              >
                Rate {shortName(ride.driver.fullName)}
              </Button>
            )}
          </Card>
        ) : null}

        {/* Shared passengers */}
        {ride.rideType === RideType.SHARED && ride.passengers.length > 0 ? (
          <Card radius="xl">
            <CardHeader
              title="Who travelled"
              description={`${ride.passengers.length} of 3 seats filled.`}
            />
            <div className="mt-5 max-w-xs">
              <SeatMap
                occupants={ride.passengers.map((passenger) => ({
                  seatIndex: passenger.seatIndex,
                  name: passenger.name.split(" ")[0],
                }))}
              />
            </div>
          </Card>
        ) : null}

        {/* Timeline */}
        {timelineItems.length > 0 ? (
          <Card radius="xl">
            <CardHeader title="What happened" />
            <Timeline items={timelineItems} className="mt-6" />
          </Card>
        ) : null}

        {/* Receipt — professional track only */}
        {isProfessional && ride.payment && isPaymentSettled(effectivePayment ?? ride.payment.status) ? (
          <div>
            <p className="type-micro mb-2.5 text-ink-muted">Receipt</p>
            <ReceiptCard
              receipt={{
                id: `rcpt-${ride.id}`,
                reference: `KX-${ride.reference.replace("#", "")}`,
                rideId: ride.id,
                rideReference: ride.reference,
                issuedAt: ride.completedAt ?? ride.requestedAt,
                driverName: ride.driver?.fullName ?? "—",
                passengerName: ride.passengers[0]?.name ?? "—",
                origin: ride.pickup.label,
                destination: ride.destination.label,
                rideType: ride.rideType,
                routeFare: ride.payment.routeFare,
                userShare: ride.payment.userShare,
                paymentStatus: effectivePayment ?? ride.payment.status,
                riders: ride.passengers.length,
              }}
            />
          </div>
        ) : null}
      </div>

      {ride.driver ? (
        <RatingSheet
          open={ratingOpen}
          onClose={() => setRatingOpen(false)}
          subjectName={ride.driver.fullName}
          subjectAvatarUrl={ride.driver.avatarUrl}
        />
      ) : null}
    </div>
  );
}
