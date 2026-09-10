"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Car, ShieldAlert, Users } from "lucide-react";
import { Card, CardHeader, NestedTile } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, StatusChip } from "@/components/ui/badge";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { ErrorState } from "@/components/ui/states";
import { PageLoader } from "@/components/ui/route-loader";
import { PageHeader } from "@/components/layout/app-shell";
import { MapCanvas } from "@/components/maps/map-canvas";
import { SosBanner } from "@/components/safety/sos-banner";
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
import { formatEta, formatRelativeTime, shortName } from "@/lib/format";

/** A single live journey, for the oversight team. */
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
      description: `${ride.passengerCount} on board`,
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
      label: "Arrival",
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

      {sos ? <SosBanner alert={sos} track={ride.track} className="mb-5" /> : null}

      <PageHeader
        eyebrow={<span className="type-numeric">Ride {ride.reference}</span>}
        title={`${shortName(ride.driverName)}'s journey`}
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
        {/* Map */}
        <Card radius="xl" padded={false} className="overflow-hidden">
          <MapCanvas
            className="h-[240px] w-full sm:h-[340px]"
            description={`Live position of ride ${ride.reference}.`}
            routes={
              ride.route
                ? [{ id: "route", path: ride.route, variant: "primary" }]
                : []
            }
            markers={[
              {
                id: "vehicle",
                position: ride.position,
                kind: ride.sosActive ? "sos" : "vehicle",
                heading: ride.heading,
                track: ride.track,
              },
            ]}
          />
        </Card>

        {/* Detail */}
        <Card radius="xl">
          <CardHeader title="Journey" />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <NestedTile className="flex items-center gap-3">
              <Avatar
                name={ride.driverName}
                src={ride.driverAvatarUrl}
                size="md"
                verified
              />
              <div className="min-w-0">
                <p className="type-micro text-ink-muted">Driver</p>
                <p className="type-body truncate font-medium text-ink">
                  {ride.driverName}
                </p>
              </div>
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
              <div className="flex items-center gap-2">
                <Users className="size-4 text-ink-muted" strokeWidth={1.7} aria-hidden />
                <p className="type-micro text-ink-muted">Passengers</p>
              </div>
              <p className="type-numeric mt-1.5 text-[0.9375rem] font-semibold text-ink">
                {ride.passengerCount} of 3
              </p>
            </NestedTile>

            <NestedTile>
              <p className="type-micro text-ink-muted">ETA</p>
              <p className="type-numeric mt-1.5 text-[0.9375rem] font-semibold text-ink">
                {ride.etaMinutes > 0 ? formatEta(ride.etaMinutes) : "Arriving"}
              </p>
            </NestedTile>
          </div>

          <p className="type-meta mt-4 text-ink-muted">
            Passenger names and contact details are only shown when an incident
            is opened.
          </p>
        </Card>

        {/* Timeline */}
        <Card radius="xl">
          <CardHeader title="Timeline" />
          <Timeline items={timeline} className="mt-6" />
        </Card>

        {/* SOS actions */}
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
              <Button variant="secondary" size="lg" className="sm:flex-1">
                Contact passenger
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
