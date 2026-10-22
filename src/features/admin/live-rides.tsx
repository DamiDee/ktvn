"use client";

import { useState } from "react";
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
import { adminData, chipCount, type RideFilter } from "./data/admin-data";
import { ADMIN_POLL_MS } from "./data/use-admin-live";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  RIDE_STATUS_PRESENTATION,
  RIDE_TYPE_LABEL,
  TRACK_LABEL,
  TRACK_TONE,
} from "@/constants/status-presentation";
import { formatEta, formatPlate, pluralise, shortName } from "@/lib/format";
import { RideStatus } from "@/types/enums";
import type { LiveRideSummary } from "@/types/models";

type Filter = RideFilter;

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

  const query = useDebouncedValue(search.trim());

  // The whole network, for the header and chip counts.
  const { data: everything } = useQuery({
    queryKey: queryKeys.admin.liveRides("ALL"),
    queryFn: () => adminData.listRides({ filter: "ALL" }),
    refetchInterval: ADMIN_POLL_MS,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.liveRides(filter, query),
    queryFn: () => adminData.listRides({ filter, q: query }),
    refetchInterval: ADMIN_POLL_MS,
  });

  const all = everything?.items ?? [];
  const rides = data?.items ?? [];
  const total = everything ? chipCount(everything.counts, "all") ?? everything.total : 0;
  const sosCount = everything ? chipCount(everything.counts, "sos") ?? all.filter((ride) => ride.sosActive).length : 0;
  const riders = all.reduce((sum, ride) => sum + ride.passengerCount, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Control centre"
        title="Live rides"
        description="Every journey in progress, who is on it and where they're going."
        action={
          <StatusChip tone="active" dot live size="md">
            {total} {pluralise(total, "ride")} · {riders}{" "}
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
              { value: "ALL", label: "All", count: total },
              { value: "SOS", label: "SOS", count: sosCount },
              { value: "IN_PROGRESS", label: "In progress" },
              { value: "MATCHING", label: "Matching" },
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
              total === 0 && !query
                ? "No rides in progress."
                : "Nothing matches that filter."
            }
            description={
              total === 0 && !query
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

export function LiveRideCard({ ride }: { ride: LiveRideSummary }) {
  const past = ride.status === RideStatus.COMPLETED || ride.status === RideStatus.CANCELLED || ride.status === RideStatus.CLOSED;
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

      {past && ride.createdAt && Number.isFinite(Date.parse(ride.createdAt)) ? <p className="type-meta mt-2 text-ink-muted">{new Date(ride.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusChip tone={TRACK_TONE[ride.track]}>
          {TRACK_LABEL[ride.track]}
        </StatusChip>
        <StatusChip tone="neutral">{RIDE_TYPE_LABEL[ride.rideType]}</StatusChip>
        {!past && ride.etaMinutes > 0 ? (
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
              {past ? `${ride.passengerCount} rider${ride.passengerCount === 1 ? "" : "s"}` : `${ride.passengerCount} of 3 on board`}
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
