"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { FilterBar, SearchInput, ListControls } from "@/components/ui/filter-bar";
import { StatusBadge, StatusChip } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/app-shell";
import { queryKeys } from "@/constants/query-keys";
import { adminData, chipCount, type IncidentFilter } from "./data/admin-data";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  INCIDENT_CATEGORY_LABEL,
  INCIDENT_SEVERITY_PRESENTATION,
  INCIDENT_STATUS_PRESENTATION,
} from "@/constants/status-presentation";
import { IncidentSeverity, IncidentStatus } from "@/types/enums";
import { formatRelativeTime, pluralise } from "@/lib/format";
import type { Incident } from "@/types/models";

type Filter = IncidentFilter;

export function IncidentsList() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");

  const query = useDebouncedValue(search.trim());

  // Unfiltered, for chip counts and the header.
  const { data: everything } = useQuery({
    queryKey: queryKeys.admin.incidents("ALL"),
    queryFn: () => adminData.listIncidents({ filter: "ALL" }),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.incidents(filter, query),
    queryFn: () => adminData.listIncidents({ filter, q: query }),
  });

  const all = everything?.items ?? [];
  const total = everything ? chipCount(everything.counts, "all") ?? everything.total : 0;
  const rows = data?.items ?? [];

  const serverOpen = everything ? chipCount(everything.counts, "open") : undefined;
  const openCount = serverOpen !== undefined
    ? serverOpen + (chipCount(everything?.counts ?? {}, "underReview") ?? 0)
    : all.filter((incident) => incident.status !== IncidentStatus.RESOLVED).length;

  const columns: DataColumn<Incident>[] = [
    {
      id: "incident",
      header: "Incident",
      primary: true,
      cell: (incident) => (
        <span className="min-w-0 block">
          <span className="type-body block truncate font-medium text-ink">
            {incident.title}
          </span>
          <span className="type-numeric type-meta block text-ink-muted">
            {incident.reference}
            {incident.rideReference ? ` · Ride ${incident.rideReference}` : ""}
          </span>
        </span>
      ),
    },
    {
      id: "category",
      header: "Category",
      meta: true,
      cell: (incident) => (
        <span className="type-meta text-ink-secondary">
          {INCIDENT_CATEGORY_LABEL[incident.category]}
        </span>
      ),
    },
    {
      id: "severity",
      header: "Severity",
      meta: true,
      cell: (incident) => (
        <StatusBadge
          presentation={INCIDENT_SEVERITY_PRESENTATION[incident.severity]}
        />
      ),
    },
    {
      id: "assigned",
      header: "Assigned",
      meta: true,
      hideBelow: "xl",
      cell: (incident) => (
        <span className="type-meta truncate text-ink-secondary">
          {incident.assignedTo ?? "Unassigned"}
        </span>
      ),
    },
    {
      id: "opened",
      header: "Opened",
      meta: true,
      cell: (incident) => (
        <span className="type-meta text-ink-secondary">
          {formatRelativeTime(incident.openedAt)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      align: "end",
      cell: (incident) => (
        <StatusBadge
          presentation={INCIDENT_STATUS_PRESENTATION[incident.status]}
        />
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Safety"
        title="Incidents"
        description="Everything raised by a member, a driver or an SOS activation."
        action={
          <StatusChip
            tone={openCount > 0 ? "pending" : "success"}
            dot
            size="md"
          >
            {openCount} {pluralise(openCount, "incident")} open
          </StatusChip>
        }
      />

      <ListControls
        className="mb-5"
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            label="Search incidents"
            placeholder="Title or reference"
          />
        }
        filters={
          <FilterBar
            label="Filter incidents"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "ALL", label: "All", count: total },
              { value: "OPEN", label: "Open" },
              { value: "UNDER_REVIEW", label: "Under review" },
              { value: "CRITICAL", label: "High and critical" },
              { value: "RESOLVED", label: "Resolved" },
            ]}
          />
        }
      />

      {isLoading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : isError ? (
        <ErrorState
          title="We couldn't load incidents."
          onRetry={() => refetch()}
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(incident) => incident.id}
          rowHref={(incident) => `/admin/incidents/${incident.id}`}
          rowTone={(incident) =>
            incident.severity === IncidentSeverity.CRITICAL &&
            incident.status !== IncidentStatus.RESOLVED
              ? "critical"
              : "default"
          }
          caption="Incidents"
          empty={
            <Card radius="xl">
              <EmptyState
                icon={ShieldAlert}
                size="sm"
                title={
                  filter === "ALL" && !search
                    ? "No incidents have been raised."
                    : "Nothing matches that filter."
                }
                description={
                  filter === "ALL" && !search
                    ? "Anything raised during a journey will appear here."
                    : "Try a different filter, or clear it to see everything."
                }
              />
            </Card>
          }
        />
      )}
    </div>
  );
}
