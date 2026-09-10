"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, StatusChip } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/app-shell";
import { MapCanvas } from "@/components/maps/map-canvas";
import { queryKeys } from "@/constants/query-keys";
import { adminService } from "@/services";
import {
  RIDE_STATUS_PRESENTATION,
  RIDE_TYPE_LABEL,
  TRACK_LABEL,
  TRACK_TONE,
} from "@/constants/status-presentation";
import { DriverTrack, RideStatus, RideType } from "@/types/enums";
import { formatEta, pluralise, shortName } from "@/lib/format";
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
 * The live network.
 *
 * On desktop this is a map beside a table. On phones the map sits above a
 * card list — a split view at 390px would leave both halves useless.
 */
export function LiveRides() {
  const [filter, setFilter] = useState<Filter>("ALL");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.liveRides(),
    queryFn: () => adminService.listLiveRides(),
  });

  const rides = useMemo(() => {
    const all = data ?? [];
    switch (filter) {
      case "SOS":
        return all.filter((ride) => ride.sosActive);
      case "VOLUNTEER":
        return all.filter((ride) => ride.track === DriverTrack.VOLUNTEER);
      case "PROFESSIONAL":
        return all.filter((ride) => ride.track === DriverTrack.PROFESSIONAL);
      case "SHARED":
        return all.filter((ride) => ride.rideType === RideType.SHARED);
      case "PRIVATE":
        return all.filter((ride) => ride.rideType === RideType.PRIVATE);
      case "MATCHING":
        return all.filter((ride) => ride.status === RideStatus.SEARCHING);
      case "IN_PROGRESS":
        return all.filter((ride) => ride.status === RideStatus.IN_PROGRESS);
      default:
        return all;
    }
  }, [data, filter]);

  const all = data ?? [];
  const sosCount = all.filter((ride) => ride.sosActive).length;

  const columns: DataColumn<LiveRideSummary>[] = [
    {
      id: "driver",
      header: "Driver",
      primary: true,
      cell: (ride) => (
        <div className="flex items-center gap-2.5">
          <Avatar
            name={ride.driverName}
            src={ride.driverAvatarUrl}
            size="xs"
            verified
          />
          <span className="min-w-0">
            <span className="type-body block truncate font-medium text-ink">
              {shortName(ride.driverName)}
            </span>
            <span className="type-numeric type-meta block text-ink-muted">
              {ride.reference}
            </span>
          </span>
        </div>
      ),
    },
    {
      id: "track",
      header: "Track",
      meta: true,
      cell: (ride) => (
        <StatusChip tone={TRACK_TONE[ride.track]}>
          {TRACK_LABEL[ride.track]}
        </StatusChip>
      ),
    },
    {
      id: "type",
      header: "Type",
      meta: true,
      cell: (ride) => (
        <span className="type-meta text-ink-secondary">
          {RIDE_TYPE_LABEL[ride.rideType]}
        </span>
      ),
    },
    {
      id: "passengers",
      header: "Passengers",
      meta: true,
      cell: (ride) => (
        <span className="type-numeric type-meta text-ink">
          {ride.passengerCount}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      align: "end",
      cell: (ride) =>
        ride.sosActive ? (
          <StatusChip tone="sos" icon={ShieldAlert} dot live>
            SOS
          </StatusChip>
        ) : (
          <StatusBadge presentation={RIDE_STATUS_PRESENTATION[ride.status]} />
        ),
    },
    {
      id: "eta",
      header: "ETA",
      meta: true,
      cell: (ride) => (
        <span className="type-numeric type-meta text-ink-secondary">
          {ride.etaMinutes > 0 ? formatEta(ride.etaMinutes) : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Control centre"
        title="Live rides"
        description="Every journey currently in progress across the network."
        action={
          <StatusChip tone="active" dot live size="md">
            {all.length} {pluralise(all.length, "ride")} live
          </StatusChip>
        }
      />

      {/* Map — full width on mobile, beside the list on desktop */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card radius="xl" padded={false} className="overflow-hidden">
          <MapCanvas
            className="h-[260px] w-full sm:h-[340px] xl:h-[620px]"
            description={`Live map showing ${rides.length} journeys in progress.`}
            routes={rides
              .filter((ride) => ride.route)
              .map((ride) => ({
                id: ride.id,
                path: ride.route!,
                variant: ride.sosActive ? ("primary" as const) : ("alternate" as const),
              }))}
            markers={rides.map((ride) => ({
              id: ride.id,
              position: ride.position,
              kind: ride.sosActive
                ? ("sos" as const)
                : ride.status === RideStatus.IN_PROGRESS ||
                    ride.status === RideStatus.DRIVER_APPROACHING
                  ? ("vehicle" as const)
                  : ("driver-idle" as const),
              heading: ride.heading,
              track: ride.track,
            }))}
          >
            {sosCount > 0 ? (
              <div className="absolute top-4 left-4 z-20">
                <span className="surface-glass inline-flex items-center gap-2 rounded-full px-3 py-2">
                  <span className="relative flex size-2">
                    <span
                      className="absolute inline-flex size-full rounded-full bg-sos-500"
                      style={{ animation: "kx-pulse-ring 1.8s ease-out infinite" }}
                      aria-hidden
                    />
                    <span className="relative inline-flex size-2 rounded-full bg-sos-500" />
                  </span>
                  <span className="type-micro text-ink">
                    {sosCount} SOS active
                  </span>
                </span>
              </div>
            ) : null}
          </MapCanvas>
        </Card>

        {/* List */}
        <div className="min-w-0">
          <FilterBar
            label="Filter live rides"
            value={filter}
            onChange={setFilter}
            className="mb-4"
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

          {isLoading ? (
            <TableSkeleton rows={5} columns={4} />
          ) : isError ? (
            <ErrorState
              title="We couldn't load live rides."
              onRetry={() => refetch()}
            />
          ) : (
            <DataTable
              rows={rides}
              columns={columns}
              rowKey={(ride) => ride.id}
              rowHref={(ride) => `/admin/live-rides/${ride.id}`}
              rowTone={(ride) => (ride.sosActive ? "critical" : "default")}
              caption="Live rides"
              empty={
                <Card radius="xl">
                  <EmptyState
                    icon={Radio}
                    size="sm"
                    title="Nothing matches that filter."
                    description="Try a different filter, or clear it to see every live ride."
                  />
                </Card>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
