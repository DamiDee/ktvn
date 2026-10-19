"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { FilterBar, SearchInput, ListControls } from "@/components/ui/filter-bar";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, StatusChip } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/app-shell";
import { queryKeys } from "@/constants/query-keys";
import { adminData, chipCount, type ApplicationFilter } from "./data/admin-data";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  TRACK_LABEL,
  TRACK_TONE,
  VERIFICATION_PRESENTATION,
} from "@/constants/status-presentation";
import { DocumentStatus } from "@/types/enums";
import { formatDate, pluralise } from "@/lib/format";
import type { DriverVerification } from "@/types/models";

type Filter = ApplicationFilter;

export function VerificationQueue() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");

  const query = useDebouncedValue(search.trim());

  // Unfiltered, for chip counts and the header.
  const { data: everything } = useQuery({
    queryKey: queryKeys.admin.verifications("ALL"),
    queryFn: () => adminData.listApplications({ filter: "ALL" }),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.verifications(filter, query),
    queryFn: () => adminData.listApplications({ filter, q: query }),
  });

  const total = everything ? chipCount(everything.counts, "all") ?? everything.total : 0;
  const rows = data?.items ?? [];

  function documentSummary(record: DriverVerification) {
    if (record.documentsTotal !== undefined) return `${record.documentsReady ?? 0}/${record.documentsTotal}`;
    const ready = record.documents.filter(
      (doc) =>
        doc.status === DocumentStatus.VERIFIED ||
        doc.status === DocumentStatus.UPLOADED,
    ).length;
    return `${ready}/${record.documents.length}`;
  }

  const columns: DataColumn<DriverVerification>[] = [
    {
      id: "applicant",
      header: "Applicant",
      primary: true,
      cell: (record) => (
        <div className="flex items-center gap-2.5">
          <Avatar
            name={record.applicantName}
            src={record.applicantAvatarUrl}
            size="xs"
          />
          <span className="min-w-0">
            <span className="type-body block truncate font-medium text-ink">
              {record.applicantName}
            </span>
            <span className="type-numeric type-meta block text-ink-muted">
              {record.id}
            </span>
          </span>
        </div>
      ),
    },
    {
      id: "track",
      header: "Track",
      meta: true,
      cell: (record) => (
        <StatusChip tone={TRACK_TONE[record.track]}>
          {TRACK_LABEL[record.track]}
        </StatusChip>
      ),
    },
    {
      id: "documents",
      header: "Documents",
      meta: true,
      cell: (record) => (
        <span className="type-numeric type-meta text-ink">
          {documentSummary(record)}
        </span>
      ),
    },
    {
      id: "vehicle",
      header: "Vehicle",
      meta: true,
      hideBelow: "xl",
      cell: (record) => (
        <span className="type-meta text-ink-secondary">
          {record.vehicle
            ? `${record.vehicle.make} ${record.vehicle.model}`
            : "—"}
        </span>
      ),
    },
    {
      id: "inspection",
      header: "Inspection",
      meta: true,
      hideBelow: "xl",
      cell: (record) => (
        <span className="type-meta text-ink-secondary">
          {!record.inspection.required
            ? "Not required"
            : record.inspection.scheduled
              ? "Scheduled"
              : "Pending"}
        </span>
      ),
    },
    {
      id: "submitted",
      header: "Submitted",
      meta: true,
      cell: (record) => (
        <span className="type-meta text-ink-secondary">
          {record.submittedAt ? formatDate(record.submittedAt) : "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      align: "end",
      cell: (record) => (
        <StatusBadge presentation={VERIFICATION_PRESENTATION[record.status]} />
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Control centre"
        title="Verification queue"
        description="Review professional driver applications, documents and inspections."
        action={
          <StatusChip tone="pending" dot size="md">
            {total} {pluralise(total, "application")}
          </StatusChip>
        }
      />

      <ListControls
        className="mb-5"
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            label="Search applicants"
            placeholder="Search by name"
          />
        }
        filters={
          <FilterBar
            label="Filter applications"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "ALL", label: "All", count: total },
              { value: "REVIEW", label: "In review" },
              { value: "INSPECTION", label: "Inspection" },
              { value: "CHANGES", label: "Changes required" },
            ]}
          />
        }
      />

      {isLoading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : isError ? (
        <ErrorState
          title="We couldn't load the queue."
          onRetry={() => refetch()}
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(record) => record.id}
          rowHref={(record) => `/admin/verifications/${record.id}`}
          caption="Verification queue"
          empty={
            <Card radius="xl">
              <EmptyState
                icon={ClipboardCheck}
                size="sm"
                title={
                  search || filter !== "ALL"
                    ? "Nothing matches that filter."
                    : "The queue is empty."
                }
                description={
                  search || filter !== "ALL"
                    ? "Try a different filter, or clear it to see every application."
                    : "Applications appear here as drivers submit them."
                }
              />
            </Card>
          }
        />
      )}
    </div>
  );
}
