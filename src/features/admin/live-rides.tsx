"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronRight, Radio, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { FilterBar, SearchInput, ListControls } from "@/components/ui/filter-bar";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { StatusBadge, StatusChip } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ListSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/app-shell";
import { queryKeys } from "@/constants/query-keys";
import { adminService } from "@/services";
import {
  RIDE_STATUS_PRESENTATION,
  RIDE_TYPE_LABEL,
  TRACK_LABEL,
  TRACK_TONE,
} from "@/constants/status-presentation";
import { DriverTrack, RideStatus, RideType } from "@/types/enums";
import { formatEta, formatPlate, pluralise, shortName } from "@/lib/format";
import type { LiveRideSummary } from "@/types/models";

type Filter =
  | "ALL"
  | "SOS"
  | "VOLUNTEER"
  | "PROFESSIONAL"
  | "SHARED"
  | "PRIVATE"
  | "MATCHING"
  | "IN_PROGRESS";

/**
 * The live network, in words rather than pixels on a map.
 *
 * Oversight needs to know who is driving, who is with them and where everyone
 * is going — a moving dot answers none of that. Each journey is one card that
 * says all of it at a glance, and opens to the full record.
 */
export function LiveRides() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.liveRides(),
    queryFn: () => adminService.listLiveRides(),
  });

  const all = useMemo(() => data ?? [], [data]);

  const rides = useMemo(() => {
    let list = all;

    switch (filter) {
      case "SOS":
        list = list.filter((ride) => ride.sosActive);
        break;
      case "VOLUNTEER":
        list = list.filter((ride) => ride.track === DriverTrack.VOLUNTEER);
        break;
      case "PROFESSIONAL":
        list = list.filter((ride) => ride.track === DriverTrack.PROFESSIONAL);
        break;
      case "SHARED":
        list = list.filter((ride) => ride.rideType === RideType.SHARED);
        break;
      case "PRIVATE":
        list = list.filter((ride) => ride.rideType === RideType.PRIVATE);
        break;
      case "MATCHING":
        list = list.filter((ride) => ride.status === RideStatus.SEARCHING);
        break;
      case "IN_PROGRESS":
        list = list.filter((ride) => ride.status === RideStatus.IN_PROGRESS);
        break;
    }

    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (ride) =>
          ride.driverName.toLowerCase().includes(term) ||
          ride.reference.toLowerCase().includes(term) ||
          ride.destinationLabel.toLowerCase().includes(term) ||
          ride.passengers.some((person) =>
            person.name.toLowerCase().includes(term),
          ),
      );
    }

    return list;
  }, [all, filter, search]);

  const sosCount = all.filter((ride) => ride.sosActive).length;
  const riders = all.reduce((total, ride) => total + ride.passengerCount, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Control centre"
        title="Live rides"
        description="Every journey in progress, who is on it and where they're going."
        action={
          <StatusChip tone="active" dot live size="md">
            {all.length} {pluralise(all.length, "ride")} · {riders}{" "}
            {pluralise(riders, "rider")}
          </StatusChip>
        }
      />

      <ListControls
        className="mb-5"
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            label="Search live rides"
            placeholder="Driver, member, destination or reference"
          />
        }
        filters={
          <FilterBar
            label="Filter live rides"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "ALL", label: "All", count: all.length },
              { value: "SOS", label: "SOS", count: sosCount },
              { value: "IN_PROGRESS", label: "In progress" },
              { value: "MATCHING", label: "Matching" },
              { value: "VOLUNTEER", label: "Volunteer" },
              { value: "PROFESSIONAL", label: "Professional" },
              { value: "SHARED", label: "Shared" },
              { value: "PRIVATE", label: "Private" },
            ]}
          />
        }
      />

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : isError ? (
        <ErrorState
          title="We couldn't load live rides."
          onRetry={() => refetch()}
        />
      ) : rides.length === 0 ? (
        <Card radius="xl">
          <EmptyState
            icon={Radio}
            size="sm"
            title={
              all.length === 0
                ? "No rides in progress."
                : "Nothing matches that filter."
            }
            description={
              all.length === 0
                ? "Journeys appear here the moment a driver is matched."
                : "Try a different filter, or clear it to see every live ride."
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {rides.map((ride) => (
            <li key={ride.id}>
              <LiveRideCard ride={ride} />
            </li>
          ))}
        </ul>
      )}

      <p className="type-meta mt-5 text-ink-muted">
        Phone numbers for the driver and the members on board are released only
        while an incident is open.
      </p>
    </div>
  );
}

function LiveRideCard({ ride }: { ride: LiveRideSummary }) {
  return (
    <Link
      href={`/admin/live-rides/${ride.id}`}
      className={cn(
        "block rounded-[var(--kx-radius-xl)] border bg-surface p-4 sm:p-5",
        "transition-[border-color,box-shadow,transform] duration-[250ms] hover:-translate-y-0.5 hover:shadow-md",
        ride.sosActive
          ? "border-sos-500/40 bg-sos-50/50 dark:bg-sos-500/8"
          : "border-line hover:border-line-strong",
      )}
    >
      {/* Where this journey is going */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-numeric type-meta text-ink-muted">
            {ride.reference}
          </p>
          <p className="type-card-title mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink">
            <span className="truncate">{ride.originLabel}</span>
            <ArrowRight
              className="size-4 shrink-0 text-ink-muted"
              strokeWidth={2}
              aria-hidden
            />
            <span className="truncate">{ride.destinationLabel}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {ride.sosActive ? (
            <StatusChip tone="sos" icon={ShieldAlert} dot live>
              SOS
            </StatusChip>
          ) : (
            <StatusBadge presentation={RIDE_STATUS_PRESENTATION[ride.status]} />
          )}
          <ChevronRight
            className="size-4 text-ink-muted"
            strokeWidth={2}
            aria-hidden
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusChip tone={TRACK_TONE[ride.track]}>
          {TRACK_LABEL[ride.track]}
        </StatusChip>
        <StatusChip tone="neutral">{RIDE_TYPE_LABEL[ride.rideType]}</StatusChip>
        {ride.etaMinutes > 0 ? (
          <StatusChip tone="info">
            Arriving in {formatEta(ride.etaMinutes)}
          </StatusChip>
        ) : null}
      </div>

      <div className="kx-hairline my-4" role="presentation" />

      {/* Who is on it */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 items-center gap-3">
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
            <p className="type-meta truncate text-ink-muted">
              {ride.vehicle.colour} {ride.vehicle.make} {ride.vehicle.model} ·{" "}
              <span className="type-numeric">
                {formatPlate(ride.vehicle.plateNumber)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <AvatarStack
            people={ride.passengers.map((person) => ({
              name: person.name,
              avatarUrl: person.avatarUrl,
            }))}
            size="md"
            max={3}
          />
          <div className="min-w-0">
            <p className="type-micro text-ink-muted">
              {ride.passengerCount} of 3 on board
            </p>
            <p className="type-body truncate font-medium text-ink">
              {ride.passengers.length > 0
                ? ride.passengers
                    .map((person) => shortName(person.name))
                    .join(", ")
                : "No one yet"}
            </p>
            <p className="type-meta truncate text-ink-muted">
              {ride.passengers.length > 0
                ? `Heading to ${[
                    ...new Set(ride.passengers.map((p) => p.dropoffLabel)),
                  ].join(", ")}`
                : "Waiting on a match"}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
