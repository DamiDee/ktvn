"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { FilterBar, SearchInput, ListControls } from "@/components/ui/filter-bar";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, StatusChip } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/app-shell";
import { queryKeys } from "@/constants/query-keys";
import { adminData, chipCount, type PassengerFilter } from "./data/admin-data";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { MEMBERSHIP_PRESENTATION } from "@/constants/status-presentation";
import { MembershipStatus } from "@/types/enums";
import { formatDate, pluralise } from "@/lib/format";
import type { Passenger } from "@/types/models";

type Filter = PassengerFilter;

export function PassengersList() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");

  const query = useDebouncedValue(search.trim());

  // Unfiltered, for chip counts and the header.
  const { data: everything } = useQuery({
    queryKey: queryKeys.admin.passengers("ALL"),
    queryFn: () => adminData.listPassengers({ filter: "ALL" }),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.passengers(filter, query),
    queryFn: () => adminData.listPassengers({ filter, q: query }),
  });

  const total = everything ? chipCount(everything.counts, "all") ?? everything.total : 0;
  const rows = data?.items ?? [];

  const columns: DataColumn<Passenger>[] = [
    {
      id: "passenger",
      header: "Member",
      primary: true,
      cell: (passenger) => (
        <div className="flex items-center gap-2.5">
          <Avatar
            name={passenger.fullName}
            src={passenger.avatarUrl}
            size="xs"
            verified={
              passenger.membershipStatus === MembershipStatus.VERIFIED
            }
          />
          <span className="min-w-0">
            <span className="type-body block truncate font-medium text-ink">
              {passenger.fullName}
            </span>
            <span className="type-meta block truncate text-ink-muted">
              {passenger.email}
            </span>
          </span>
        </div>
      ),
    },
    {
      id: "area",
      header: "Area",
      meta: true,
      hideBelow: "xl",
      cell: (passenger) => (
        <span className="type-meta truncate text-ink-secondary">
          {passenger.homeArea ?? "Not set"}
        </span>
      ),
    },
    {
      id: "rides",
      header: "Rides",
      meta: true,
      cell: (passenger) => (
        <span className="type-numeric type-meta text-ink">
          {passenger.totalRides}
        </span>
      ),
    },
    {
      id: "rating",
      header: "Rating",
      meta: true,
      cell: (passenger) => (
        <span className="type-numeric type-meta inline-flex items-center gap-1 text-ink">
          <Star
            className="size-3.5 text-gold-500"
            strokeWidth={2}
            fill="currentColor"
            aria-hidden
          />
          {passenger.rating.toFixed(1)}
        </span>
      ),
    },
    {
      id: "contacts",
      header: "Contacts",
      meta: true,
      hideBelow: "xl",
      cell: (passenger) => (
        <span className="type-numeric type-meta text-ink-secondary">
          {passenger.trustedContactCount ?? passenger.trustedContacts.length}
        </span>
      ),
    },
    {
      id: "joined",
      header: "Joined",
      meta: true,
      hideBelow: "xl",
      cell: (passenger) => (
        <span className="type-meta text-ink-secondary">
          {formatDate(passenger.joinedAt)}
        </span>
      ),
    },
    {
      id: "membership",
      header: "Membership",
      align: "end",
      cell: (passenger) => (
        <StatusBadge
          presentation={MEMBERSHIP_PRESENTATION[passenger.membershipStatus]}
        />
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="System Users"
        title="Passengers"
        description="Members who can request a ride on the network."
        action={
          <StatusChip tone="neutral" size="md">
            {total} {pluralise(total, "member")}
          </StatusChip>
        }
      />

      <ListControls
        className="mb-5"
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            label="Search members"
            placeholder="Name or email"
          />
        }
        filters={
          <FilterBar
            label="Filter members"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "ALL", label: "All", count: total },
              { value: "VERIFIED", label: "Verified" },
              { value: "PENDING", label: "Not yet confirmed" },
              { value: "NO_CONTACTS", label: "No trusted contact" },
            ]}
          />
        }
      />

      {isLoading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : isError ? (
        <ErrorState
          title="We couldn't load the member list."
          onRetry={() => refetch()}
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(passenger) => passenger.id}
          rowHref={(passenger) => `/admin/passengers/${passenger.id}`}
          caption="Passengers"
          empty={
            <Card radius="xl">
              <EmptyState
                icon={Users}
                size="sm"
                title="No members match that filter."
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
    </div>
  );
}
