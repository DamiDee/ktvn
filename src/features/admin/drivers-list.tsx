"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Car, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { FilterBar, SearchInput, ListControls } from "@/components/ui/filter-bar";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, StatusChip } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/app-shell";
import { queryKeys } from "@/constants/query-keys";
import { userService } from "@/services";
import {
  DRIVER_AVAILABILITY_PRESENTATION,
  TRACK_LABEL,
  TRACK_TONE,
  VERIFICATION_PRESENTATION,
} from "@/constants/status-presentation";
import {
  DriverAvailability,
  DriverTrack,
  VerificationStatus,
} from "@/types/enums";
import { formatPlate, pluralise } from "@/lib/format";
import type { Driver } from "@/types/models";

type Filter =
  | "ALL"
  | "VOLUNTEER"
  | "PROFESSIONAL"
  | "ONLINE"
  | "PENDING"
  | "FLAGGED";

/**
 * Everyone approved to drive.
 *
 * The list shows trips and rating for both tracks and money for neither —
 * a driver's earnings belong on their own record, not in a roster.
 */
export function DriversList() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.drivers(),
    queryFn: () => userService.listDrivers(),
  });

  const all = useMemo(() => data ?? [], [data]);

  const rows = useMemo(() => {
    let list = all;

    switch (filter) {
      case "VOLUNTEER":
        list = list.filter((driver) => driver.track === DriverTrack.VOLUNTEER);
        break;
      case "PROFESSIONAL":
        list = list.filter(
          (driver) => driver.track === DriverTrack.PROFESSIONAL,
        );
        break;
      case "ONLINE":
        list = list.filter(
          (driver) => driver.availability !== DriverAvailability.OFFLINE,
        );
        break;
      case "PENDING":
        list = list.filter(
          (driver) => driver.verificationStatus !== VerificationStatus.APPROVED,
        );
        break;
      case "FLAGGED":
        list = list.filter((driver) => driver.flagged);
        break;
    }

    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (driver) =>
          driver.fullName.toLowerCase().includes(term) ||
          driver.vehicle.plateNumber.toLowerCase().includes(term),
      );
    }

    return list;
  }, [all, filter, search]);

  const columns: DataColumn<Driver>[] = [
    {
      id: "driver",
      header: "Driver",
      primary: true,
      cell: (driver) => (
        <div className="flex items-center gap-2.5">
          <Avatar
            name={driver.fullName}
            src={driver.avatarUrl}
            size="xs"
            verified={
              driver.verificationStatus === VerificationStatus.APPROVED
            }
          />
          <span className="min-w-0">
            <span className="type-body block truncate font-medium text-ink">
              {driver.fullName}
            </span>
            <span className="type-numeric type-meta block text-ink-muted">
              {driver.memberId}
            </span>
          </span>
        </div>
      ),
    },
    {
      id: "track",
      header: "Track",
      meta: true,
      cell: (driver) => (
        <StatusChip tone={TRACK_TONE[driver.track]}>
          {TRACK_LABEL[driver.track]}
        </StatusChip>
      ),
    },
    {
      id: "vehicle",
      header: "Vehicle",
      meta: true,
      hideBelow: "xl",
      cell: (driver) => (
        <span className="type-meta truncate text-ink-secondary">
          {driver.vehicle.make} {driver.vehicle.model} ·{" "}
          <span className="type-numeric">
            {formatPlate(driver.vehicle.plateNumber)}
          </span>
        </span>
      ),
    },
    {
      id: "trips",
      header: "Trips",
      meta: true,
      cell: (driver) => (
        <span className="type-numeric type-meta text-ink">
          {driver.totalTrips}
        </span>
      ),
    },
    {
      id: "rating",
      header: "Rating",
      meta: true,
      cell: (driver) => (
        <span className="type-numeric type-meta inline-flex items-center gap-1 text-ink">
          <Star
            className="size-3.5 text-gold-500"
            strokeWidth={2}
            fill="currentColor"
            aria-hidden
          />
          {driver.rating.toFixed(1)}
        </span>
      ),
    },
    {
      id: "availability",
      header: "Status",
      align: "end",
      cell: (driver) => (
        <StatusBadge
          presentation={
            driver.verificationStatus === VerificationStatus.APPROVED
              ? DRIVER_AVAILABILITY_PRESENTATION[driver.availability]
              : VERIFICATION_PRESENTATION[driver.verificationStatus]
          }
        />
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="People"
        title="Drivers"
        description="Everyone approved to carry members, on either track."
        action={
          <StatusChip tone="neutral" size="md">
            {all.length} {pluralise(all.length, "driver")}
          </StatusChip>
        }
      />

      <ListControls
        className="mb-5"
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            label="Search drivers"
            placeholder="Name or plate number"
          />
        }
        filters={
          <FilterBar
            label="Filter drivers"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "ALL", label: "All", count: all.length },
              { value: "ONLINE", label: "Online" },
              { value: "VOLUNTEER", label: "Volunteer" },
              { value: "PROFESSIONAL", label: "Professional" },
              { value: "PENDING", label: "Not yet approved" },
              {
                value: "FLAGGED",
                label: "Flagged",
                count: all.filter((driver) => driver.flagged).length,
              },
            ]}
          />
        }
      />

      {isLoading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : isError ? (
        <ErrorState
          title="We couldn't load the driver list."
          onRetry={() => refetch()}
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(driver) => driver.id}
          rowHref={(driver) => `/admin/drivers/${driver.id}`}
          rowTone={(driver) => (driver.flagged ? "critical" : "default")}
          caption="Drivers"
          empty={
            <Card radius="xl">
              <EmptyState
                icon={Car}
                size="sm"
                title="No drivers match that filter."
                description={
                  search
                    ? `Nothing found for "${search}".`
                    : "Try a different filter, or clear it to see everyone."
                }
              />
            </Card>
          }
        />
      )}

      <p className="type-meta mt-5 text-ink-muted">
        Every driver here passed the same verification, whichever track they
        drive on.
      </p>
    </div>
  );
}
