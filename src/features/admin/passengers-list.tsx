"use client";

import { useMemo, useState } from "react";
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
import { userService } from "@/services";
import { MEMBERSHIP_PRESENTATION } from "@/constants/status-presentation";
import { MembershipStatus } from "@/types/enums";
import { formatDate, pluralise } from "@/lib/format";
import type { Passenger } from "@/types/models";

type Filter = "ALL" | "VERIFIED" | "PENDING" | "NO_CONTACTS";

export function PassengersList() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.passengers(),
    queryFn: () => userService.listPassengers(),
  });

  const all = useMemo(() => data ?? [], [data]);

  const rows = useMemo(() => {
    let list = all;

    switch (filter) {
      case "VERIFIED":
        list = list.filter(
          (passenger) =>
            passenger.membershipStatus === MembershipStatus.VERIFIED,
        );
        break;
      case "PENDING":
        list = list.filter(
          (passenger) =>
            passenger.membershipStatus !== MembershipStatus.VERIFIED,
        );
        break;
      case "NO_CONTACTS":
        list = list.filter(
          (passenger) => passenger.trustedContacts.length === 0,
        );
        break;
    }

    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (passenger) =>
          passenger.fullName.toLowerCase().includes(term) ||
          passenger.email.toLowerCase().includes(term),
      );
    }

    return list;
  }, [all, filter, search]);

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
          {passenger.trustedContacts.length}
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
            {all.length} {pluralise(all.length, "member")}
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
              { value: "ALL", label: "All", count: all.length },
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
