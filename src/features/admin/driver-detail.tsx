"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Car,
  ClipboardCheck,
  Clock,
  Flag,
  Route as RouteIcon,
  Star,
  Users,
} from "lucide-react";
import { Card, CardHeader, DataPoint, NestedTile } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, StatusChip, VerifiedBadge } from "@/components/ui/badge";
import { CountUp } from "@/components/ui/stats-card";
import { ConfirmDialog } from "@/components/ui/modal";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { PageLoader } from "@/components/ui/route-loader";
import { PageHeader } from "@/components/layout/app-shell";
import { queryKeys } from "@/constants/query-keys";
import { rideService, userService } from "@/services";
import {
  DRIVER_AVAILABILITY_PRESENTATION,
  RIDE_STATUS_PRESENTATION,
  RIDE_TYPE_LABEL,
  TRACK_DESCRIPTION,
  TRACK_LABEL,
  TRACK_TONE,
  VERIFICATION_PRESENTATION,
} from "@/constants/status-presentation";
import { DriverTrack, VerificationStatus } from "@/types/enums";
import {
  formatDate,
  formatNaira,
  formatPlate,
  pluralise,
} from "@/lib/format";

/**
 * One driver's record.
 *
 * Money appears here only for a professional driver, and only as a record of
 * what has been earned — Product Rules 1 and 7. A volunteer's contribution is
 * measured in trips, hours and people carried.
 */
export function DriverDetail({ driverId }: { driverId: string }) {
  const { toast } = useToast();
  const [suspending, setSuspending] = useState(false);
  const [suspended, setSuspended] = useState(false);

  const { data: driver, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.driver(driverId),
    queryFn: () => userService.getDriver(driverId),
  });

  // Narrowed to the driver's own track: a volunteer's record must never show
  // a professional trip's fare (Product Rule 1).
  const { data: trips } = useQuery({
    queryKey: [...queryKeys.admin.driver(driverId), "trips", driver?.track],
    queryFn: () => rideService.listDriverTrips(driver?.track),
    enabled: Boolean(driver),
  });

  if (isLoading) return <PageLoader message="Loading the driver record" />;

  if (isError || !driver) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorState
          title="We couldn't find that driver."
          description="The record may have been removed, or the link may be out of date."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const volunteer = driver.track === DriverTrack.VOLUNTEER;
  const approved =
    driver.verificationStatus === VerificationStatus.APPROVED && !suspended;
  const recentTrips = (trips ?? []).slice(0, 4);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/drivers"
        className="kx-tap type-meta mb-4 inline-flex items-center gap-1.5 font-medium text-ink-secondary transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
        Drivers
      </Link>

      <PageHeader
        eyebrow="Driver record"
        title={driver.fullName}
        action={
          suspended ? (
            <StatusChip tone="danger" size="md">
              Suspended
            </StatusChip>
          ) : (
            <StatusBadge
              presentation={
                driver.verificationStatus === VerificationStatus.APPROVED
                  ? DRIVER_AVAILABILITY_PRESENTATION[driver.availability]
                  : VERIFICATION_PRESENTATION[driver.verificationStatus]
              }
              size="md"
            />
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          {/* Identity */}
          <Card radius="xl">
            <div className="flex min-w-0 flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <Avatar
                name={driver.fullName}
                src={driver.avatarUrl}
                size="xl"
                verified={approved}
              />
              <div className="w-full min-w-0 flex-1">
                <h2 className="type-section-title truncate text-ink">
                  {driver.fullName}
                </h2>
                <p className="type-meta mt-1 truncate text-ink-muted">
                  {driver.email} · Joined{" "}
                  {new Date(driver.joinedAt).getFullYear()}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <StatusChip tone={TRACK_TONE[driver.track]}>
                    {TRACK_LABEL[driver.track]}
                  </StatusChip>
                  {approved ? <VerifiedBadge label="Verified driver" /> : null}
                  {driver.flagged ? (
                    <StatusChip tone="pending" icon={Flag}>
                      Flagged for review
                    </StatusChip>
                  ) : null}
                </div>
              </div>
            </div>

            <p className="type-meta mt-4 text-ink-secondary">
              {TRACK_DESCRIPTION[driver.track]}
            </p>
          </Card>

          {/* Service or earnings — never both */}
          <Card radius="xl">
            <CardHeader
              title={volunteer ? "Service" : "Activity"}
              description={
                volunteer
                  ? "What this driver has contributed to the community."
                  : "Trips completed and earnings recorded on the professional track."
              }
            />

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                icon={RouteIcon}
                label="Total trips"
                value={driver.totalTrips}
              />
              <StatTile
                icon={Star}
                label="Rating"
                value={driver.rating.toFixed(1)}
                raw
              />

              {volunteer && driver.service ? (
                <>
                  <StatTile
                    icon={Clock}
                    label="Service hours"
                    value={driver.service.serviceHours}
                  />
                  <StatTile
                    icon={Users}
                    label="People carried"
                    value={driver.service.passengersServed}
                  />
                </>
              ) : driver.earningsSummary ? (
                <>
                  <StatTile
                    icon={RouteIcon}
                    label="Trips this week"
                    value={driver.earningsSummary.weekTrips}
                  />
                  <StatTile
                    icon={Star}
                    label="Week to date"
                    value={formatNaira(driver.earningsSummary.weekToDate)}
                    raw
                  />
                </>
              ) : null}
            </div>

            {volunteer ? (
              <p className="type-meta mt-4 text-ink-muted">
                Volunteer drivers are never paid, and no fare is ever shown to
                them or to their passengers.
              </p>
            ) : (
              <p className="type-meta mt-4 text-ink-muted">
                Earnings are a record of completed rides, not a balance the
                network holds.
              </p>
            )}

            {volunteer && driver.service?.badges?.length ? (
              <div className="mt-5">
                <p className="type-micro text-ink-muted">Recognition</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {driver.service.badges.map((badge) => (
                    <StatusChip key={badge.id} tone="success">
                      {badge.name}
                    </StatusChip>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          {/* Vehicle */}
          <Card radius="xl">
            <CardHeader
              title="Vehicle"
              action={
                driver.vehicle.verified ? (
                  <StatusChip tone="success">Inspected</StatusChip>
                ) : (
                  <StatusChip tone="pending">Not inspected</StatusChip>
                )
              }
            />

            <NestedTile className="mt-5 flex items-center gap-3.5">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink-secondary ring-1 ring-line">
                <Car className="size-5" strokeWidth={1.7} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="type-card-title truncate text-ink">
                  {driver.vehicle.colour} {driver.vehicle.make}{" "}
                  {driver.vehicle.model}
                </p>
                <p className="type-meta type-numeric mt-0.5 text-ink-muted">
                  {formatPlate(driver.vehicle.plateNumber)} ·{" "}
                  {driver.vehicle.seats} {pluralise(driver.vehicle.seats, "seat")}
                </p>
              </div>
            </NestedTile>
          </Card>

          {/* Recent trips */}
          <Card radius="xl">
            <CardHeader
              title="Recent trips"
              description="The last few journeys on this record."
            />

            <div className="mt-5">
              {recentTrips.length === 0 ? (
                <EmptyState
                  icon={RouteIcon}
                  size="sm"
                  title="No trips recorded yet."
                  description="Journeys appear here once the driver completes one."
                />
              ) : (
                <ul className="space-y-2.5">
                  {recentTrips.map((trip) => (
                    <li key={trip.id}>
                      <NestedTile className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="type-body truncate font-medium text-ink">
                            {trip.destination.label}
                          </p>
                          <p className="type-meta truncate text-ink-muted">
                            <span className="type-numeric">
                              {trip.reference}
                            </span>{" "}
                            · {RIDE_TYPE_LABEL[trip.rideType]} ·{" "}
                            {formatDate(trip.requestedAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {/* Volunteer rides carry no fare at all. */}
                          {trip.track === DriverTrack.PROFESSIONAL &&
                          trip.fare !== undefined ? (
                            <span className="type-numeric type-meta text-ink">
                              {formatNaira(trip.fare)}
                            </span>
                          ) : null}
                          <StatusBadge
                            presentation={RIDE_STATUS_PRESENTATION[trip.status]}
                          />
                        </div>
                      </NestedTile>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="min-w-0">
          <Card radius="xl" className="lg:sticky lg:top-20">
            <CardHeader title="Oversight" />

            <div className="mt-5 space-y-3">
              <NestedTile>
                <DataPoint
                  label="Verification"
                  value={
                    VERIFICATION_PRESENTATION[driver.verificationStatus].label
                  }
                  hint={
                    VERIFICATION_PRESENTATION[driver.verificationStatus].detail
                  }
                />
              </NestedTile>

              {driver.trackSwitch ? (
                <NestedTile className="flex items-start gap-3">
                  <ClipboardCheck
                    className="mt-0.5 size-4 shrink-0 text-ink-muted"
                    strokeWidth={1.8}
                    aria-hidden
                  />
                  <p className="type-meta text-ink-secondary">
                    A track switch to{" "}
                    {TRACK_LABEL[driver.trackSwitch.toTrack]} is{" "}
                    {driver.trackSwitch.status === "APPROVED"
                      ? "approved"
                      : "awaiting a decision"}
                    . Switching is reviewed, never an instant toggle.
                  </p>
                </NestedTile>
              ) : null}
            </div>

            <div className="mt-5 space-y-2.5">
              <Button
                variant="secondary"
                size="lg"
                icon={Flag}
                className="w-full"
                onClick={() =>
                  toast({
                    title: "Flagged for quality review",
                    description: "This driver now appears on the quality board.",
                  })
                }
              >
                Flag for review
              </Button>

              <Button
                variant="ghost"
                size="lg"
                icon={AlertTriangle}
                className="w-full text-danger-600 dark:text-red-300"
                disabled={suspended}
                onClick={() => setSuspending(true)}
              >
                {suspended ? "Suspended" : "Suspend driver"}
              </Button>
            </div>

            <p className="type-meta mt-5 text-ink-muted">
              Suspension stops new ride offers immediately. Any journey already
              in progress is monitored to its end.
            </p>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={suspending}
        onClose={() => setSuspending(false)}
        onConfirm={() => {
          setSuspended(true);
          setSuspending(false);
          toast({
            title: `${driver.fullName} suspended`,
            description: "They will receive no further ride offers.",
            tone: "danger",
          });
        }}
        title="Suspend this driver?"
        description="They stop receiving ride offers straight away. You can lift a suspension later from this record."
        confirmLabel="Suspend"
        tone="danger"
      />
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  raw,
}: {
  icon: typeof RouteIcon;
  label: string;
  value: number | string;
  raw?: boolean;
}) {
  return (
    <NestedTile className="text-center">
      <Icon
        className="mx-auto size-4 text-ink-muted"
        strokeWidth={1.7}
        aria-hidden
      />
      <p className="type-numeric mt-2 text-[1.125rem] leading-none font-semibold text-ink">
        {raw || typeof value === "string" ? value : <CountUp value={value} />}
      </p>
      <p className="type-micro mt-1.5 text-ink-muted">{label}</p>
    </NestedTile>
  );
}
