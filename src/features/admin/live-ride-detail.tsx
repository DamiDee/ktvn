"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Car,
  Phone,
  ShieldAlert,
  Star,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardHeader, DataPoint, NestedTile } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, StatusChip, VerifiedBadge } from "@/components/ui/badge";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { ErrorState } from "@/components/ui/states";
import { PageLoader } from "@/components/ui/route-loader";
import { PageHeader } from "@/components/layout/app-shell";
import { queryKeys } from "@/constants/query-keys";
import { adminService } from "@/services";
import { ACTIVE_SOS } from "@/mocks/admin";
import {
  RIDE_STATUS_PRESENTATION,
  RIDE_TYPE_LABEL,
  SOS_PRESENTATION,
  TRACK_LABEL,
  TRACK_TONE,
} from "@/constants/status-presentation";
import { RidePassengerState } from "@/types/enums";
import {
  formatEta,
  formatPlate,
  formatRelativeTime,
  formatTime,
  shortName,
} from "@/lib/format";
import type { LiveRidePassenger } from "@/types/models";

const PASSENGER_STATE: Record<
  RidePassengerState,
  { label: string; tone: "neutral" | "active" | "pending" | "success" }
> = {
  [RidePassengerState.AWAITING_PICKUP]: {
    label: "Waiting to be collected",
    tone: "pending",
  },
  [RidePassengerState.PICKED_UP]: { label: "On board", tone: "active" },
  [RidePassengerState.DROPPED_OFF]: { label: "Dropped off", tone: "success" },
  [RidePassengerState.NO_SHOW]: { label: "Didn't show", tone: "neutral" },
};

/**
 * One live journey, read rather than watched.
 *
 * Everything oversight needs to act — who is driving, what they are driving,
 * who is on board and where each of them gets out — is text on this page. The
 * contact details stay withheld until an incident is opened, which is the one
 * moment they are needed.
 */
export function LiveRideDetail({ rideId }: { rideId: string }) {
  const { data: ride, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.liveRide(rideId),
    queryFn: () => adminService.getLiveRide(rideId),
  });

  if (isLoading) return <PageLoader message="Loading the journey" />;

  if (isError || !ride) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorState
          title="We couldn't find that ride."
          description="It may have completed, or the link may be out of date."
          onRetry={() => refetch()}
          action={
            <ButtonLink
              href="/admin/live-rides"
              variant="secondary"
              size="md"
              icon={ArrowLeft}
            >
              Back to live rides
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const sos = ride.sosActive ? ACTIVE_SOS : null;
  const onBoard = ride.passengers.filter(
    (person) => person.state === RidePassengerState.PICKED_UP,
  ).length;

  const timeline: TimelineItem[] = [
    {
      id: "requested",
      label: "Ride requested",
      description: `${TRACK_LABEL[ride.track]} · ${RIDE_TYPE_LABEL[ride.rideType]}`,
      state: "COMPLETE",
    },
    {
      id: "matched",
      label: "Driver matched",
      description: shortName(ride.driverName),
      state: "COMPLETE",
    },
    {
      id: "progress",
      label: "Journey in progress",
      description: `${onBoard} of ${ride.passengerCount} on board`,
      meta: ride.startedAt ? formatTime(ride.startedAt) : undefined,
      state: "ACTIVE",
    },
    ...(sos
      ? [
          {
            id: "sos",
            label: "SOS raised",
            description: `${SOS_PRESENTATION[sos.status].detail} · raised by ${sos.raisedByName}`,
            meta: formatRelativeTime(sos.raisedAt),
            state: "BLOCKED" as const,
          },
        ]
      : []),
    {
      id: "arrival",
      label: `Arrival at ${ride.destinationLabel}`,
      description:
        ride.etaMinutes > 0
          ? `Expected in ${formatEta(ride.etaMinutes)}`
          : "Arriving now",
      state: "PENDING",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin/live-rides"
        className="kx-tap type-meta mb-4 inline-flex items-center gap-1.5 font-medium text-ink-secondary transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
        Live rides
      </Link>

      <PageHeader
        eyebrow={<span className="type-numeric">Ride {ride.reference}</span>}
        title={`${ride.originLabel} → ${ride.destinationLabel}`}
        action={
          ride.sosActive ? (
            <StatusChip tone="sos" icon={ShieldAlert} dot live size="md">
              SOS active
            </StatusChip>
          ) : (
            <StatusBadge
              presentation={RIDE_STATUS_PRESENTATION[ride.status]}
              size="md"
              live
            />
          )
        }
      />

      <div className="space-y-5">
        {/* Journey */}
        <Card radius="xl">
          <CardHeader title="Journey" />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <NestedTile>
              <DataPoint label="From" value={ride.originLabel} />
            </NestedTile>
            <NestedTile>
              <DataPoint label="To" value={ride.destinationLabel} />
            </NestedTile>
            <NestedTile>
              <div className="flex items-center gap-2">
                <Car className="size-4 text-ink-muted" strokeWidth={1.7} aria-hidden />
                <p className="type-micro text-ink-muted">Track and type</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusChip tone={TRACK_TONE[ride.track]}>
                  {TRACK_LABEL[ride.track]}
                </StatusChip>
                <StatusChip tone="neutral">
                  {RIDE_TYPE_LABEL[ride.rideType]}
                </StatusChip>
              </div>
            </NestedTile>
            <NestedTile>
              <DataPoint
                label="Arrival"
                value={
                  ride.etaMinutes > 0 ? formatEta(ride.etaMinutes) : "Arriving"
                }
                hint={
                  ride.startedAt
                    ? `Started ${formatTime(ride.startedAt)}`
                    : undefined
                }
              />
            </NestedTile>
          </div>
        </Card>

        {/* Driver */}
        <Card radius="xl">
          <CardHeader
            title="Driver"
            action={
              <ButtonLink
                href={`/admin/drivers/${ride.driverId}`}
                variant="ghost"
                size="sm"
                iconRight={ArrowRight}
              >
                Full record
              </ButtonLink>
            }
          />

          <NestedTile className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              <Avatar
                name={ride.driverName}
                src={ride.driverAvatarUrl}
                size="lg"
                verified
              />
              <div className="min-w-0">
                <p className="type-card-title truncate text-ink">
                  {ride.driverName}
                </p>
                <p className="type-meta mt-0.5 inline-flex items-center gap-1.5 text-ink-secondary">
                  <Star
                    className="size-3.5 text-gold-500"
                    strokeWidth={2}
                    fill="currentColor"
                    aria-hidden
                  />
                  <span className="type-numeric">
                    {ride.driverRating.toFixed(1)}
                  </span>
                  · {ride.driverTrips} trips
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusChip tone={TRACK_TONE[ride.track]}>
                    {TRACK_LABEL[ride.track]}
                  </StatusChip>
                  <VerifiedBadge label="Verified driver" />
                </div>
              </div>
            </div>

            <div className="shrink-0 sm:text-right">
              <p className="type-micro text-ink-muted">Vehicle</p>
              <p className="type-body font-medium text-ink">
                {ride.vehicle.colour} {ride.vehicle.make} {ride.vehicle.model}
              </p>
              <p className="type-numeric type-meta mt-0.5 text-ink-secondary">
                {formatPlate(ride.vehicle.plateNumber)}
              </p>
            </div>
          </NestedTile>

          <ContactLine
            label="Driver's phone"
            value={ride.driverPhone}
            className="mt-3"
          />
        </Card>

        {/* Passengers */}
        <Card radius="xl">
          <CardHeader
            title="Passengers"
            description="Everyone on this journey and where each of them gets out."
            action={
              <StatusChip tone="neutral" icon={Users}>
                {ride.passengerCount} of 3
              </StatusChip>
            }
          />

          <ul className="mt-5 space-y-2.5">
            {ride.passengers.map((person) => (
              <li key={person.id}>
                <PassengerRow person={person} />
              </li>
            ))}
          </ul>

          {ride.passengers.length === 0 ? (
            <p className="type-meta mt-4 text-ink-muted">
              No one has been matched to this journey yet.
            </p>
          ) : null}
        </Card>

        {/* Timeline */}
        <Card radius="xl">
          <CardHeader title="Timeline" />
          <Timeline items={timeline} className="mt-6" />
        </Card>

        {/* SOS response */}
        {sos ? (
          <Card radius="xl" className="border-sos-500/30">
            <CardHeader
              title="Safety response"
              description={SOS_PRESENTATION[sos.status].detail}
              action={
                <StatusBadge
                  presentation={SOS_PRESENTATION[sos.status]}
                  live
                  size="md"
                />
              }
            />
            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <ButtonLink
                href="/admin/incidents"
                variant="danger"
                size="lg"
                className="sm:flex-1"
              >
                Open incident
              </ButtonLink>
              <Button variant="secondary" size="lg" icon={Phone} className="sm:flex-1">
                Contact the driver
              </Button>
            </div>
            <p className="type-meta mt-3 text-ink-muted">
              Opening an incident releases the phone numbers for everyone on
              this journey.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function PassengerRow({ person }: { person: LiveRidePassenger }) {
  const state = PASSENGER_STATE[person.state];

  return (
    <NestedTile>
      <div className="flex items-start gap-3">
        <Avatar
          name={person.name}
          src={person.avatarUrl}
          size="md"
          verified={person.verified}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="type-body truncate font-medium text-ink">
              {person.name}
            </p>
            {person.verified ? <VerifiedBadge label="Verified member" /> : null}
          </div>

          <p className="type-meta mt-0.5 inline-flex items-center gap-1.5 text-ink-secondary">
            <Star
              className="size-3.5 text-gold-500"
              strokeWidth={2}
              fill="currentColor"
              aria-hidden
            />
            <span className="type-numeric">{person.rating.toFixed(1)}</span>
          </p>

          <p className="type-meta mt-1 flex items-start gap-1.5 text-ink-muted">
            <ArrowRight
              className="mt-0.5 size-3.5 shrink-0"
              strokeWidth={2}
              aria-hidden
            />
            <span className="min-w-0 truncate">
              Getting out at {person.dropoffLabel}
            </span>
          </p>
        </div>

        <StatusChip tone={state.tone} className="shrink-0">
          {state.label}
        </StatusChip>
      </div>

      <ContactLine
        label={`${shortName(person.name)}'s phone`}
        value={person.phone}
        className="mt-3"
      />
    </NestedTile>
  );
}

/** Contact details are held back until an incident is open. */
function ContactLine({
  label,
  value,
  className,
}: {
  label: string;
  value?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-[var(--kx-radius-sm)] bg-surface px-3.5 py-2.5",
        className,
      )}
    >
      <span className="type-meta flex items-center gap-2 text-ink-muted">
        <Phone className="size-3.5" strokeWidth={1.9} aria-hidden />
        {label}
      </span>
      <span
        className={cn(
          "type-meta shrink-0",
          value ? "type-numeric font-medium text-ink" : "text-ink-muted",
        )}
      >
        {value ?? "Released with an incident"}
      </span>
    </div>
  );
}
