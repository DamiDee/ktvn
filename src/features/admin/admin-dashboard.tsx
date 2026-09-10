"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Car,
  ClipboardCheck,
  Radio,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardHeader } from "@/components/ui/card";
import { StatsCard } from "@/components/ui/stats-card";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { StatusBadge, StatusChip } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/states";
import { StatsCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/app-shell";
import { queryKeys } from "@/constants/query-keys";
import { adminService } from "@/services";
import {
  RIDE_STATUS_PRESENTATION,
  RIDE_TYPE_LABEL,
  TRACK_LABEL,
  TRACK_TONE,
} from "@/constants/status-presentation";
import { formatEta, shortName } from "@/lib/format";
import type { LiveRideSummary } from "@/types/models";

const METRIC_ICONS = [Car, Radio, ClipboardCheck, ShieldAlert];
const METRIC_ACCENTS = ["forest", "lilac", "gold", "neutral"] as const;

/** Cards on a phone, a table from `lg` up — never a sideways scroll. */
const LIVE_COLUMNS: DataColumn<LiveRideSummary>[] = [
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
    hideBelow: "xl",
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
    id: "eta",
    header: "ETA",
    meta: true,
    cell: (ride) => (
      <span className="type-numeric type-meta text-ink-secondary">
        {ride.etaMinutes > 0 ? formatEta(ride.etaMinutes) : "—"}
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
];

export function AdminDashboard() {
  const { data: overview, isLoading } = useQuery({
    queryKey: queryKeys.admin.overview(),
    queryFn: () => adminService.getOverview(),
  });

  const { data: liveRides, isLoading: loadingRides } = useQuery({
    queryKey: queryKeys.admin.liveRides(),
    queryFn: () => adminService.listLiveRides(),
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Control centre"
        title="Network overview"
        description="Live journeys, verification throughput and anything needing attention."
      />

      {/* Primary metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? [0, 1, 2, 3].map((index) => <StatsCardSkeleton key={index} />)
          : overview?.primary.map((metric, index) => (
              <StatsCard
                key={metric.id}
                label={metric.label}
                value={metric.display ?? metric.value}
                numericValue={metric.display ? undefined : metric.value}
                deltaPercent={metric.deltaPercent}
                icon={METRIC_ICONS[index]}
                accent={METRIC_ACCENTS[index]}
                sparkline={metric.series}
              />
            ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Live rides */}
        <Card radius="xl" className="min-w-0">
          <CardHeader
            title="Live rides"
            description="Journeys currently in progress across the network."
            action={
              <Link
                href="/admin/live-rides"
                className="kx-tap type-meta inline-flex items-center font-medium text-forest-700 underline-offset-4 hover:underline dark:text-gold-300"
              >
                Open live map
              </Link>
            }
          />

          <div className="mt-5">
            {loadingRides ? (
              <TableSkeleton rows={5} columns={5} />
            ) : !liveRides || liveRides.length === 0 ? (
              <EmptyState
                icon={Radio}
                size="sm"
                title="No live rides."
                description="Journeys appear here the moment a driver is matched."
              />
            ) : (
              <DataTable
                rows={liveRides}
                columns={LIVE_COLUMNS}
                rowKey={(ride) => ride.id}
                rowHref={(ride) => `/admin/live-rides/${ride.id}`}
                rowTone={(ride) => (ride.sosActive ? "critical" : "default")}
                caption="Live rides"
              />
            )}
          </div>
        </Card>

        {/* Secondary metrics + distribution */}
        <div className="min-w-0 space-y-5">
          <Card radius="xl">
            <CardHeader title="Track distribution" description="Share of completed rides." />

            <div className="mt-5 space-y-4">
              {overview?.trackDistribution.map((entry) => (
                <div key={entry.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="type-meta text-ink-secondary">{entry.label}</span>
                    <span className="type-numeric text-[0.875rem] font-semibold text-ink">
                      {entry.value}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--kx-text)_8%,transparent)]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-700 ease-[var(--kx-ease-out)]",
                        entry.tone === "gold" ? "bg-gold-500" : "bg-lilac-600",
                      )}
                      style={{ width: `${entry.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card radius="xl">
            <CardHeader title="Network quality" />

            <dl className="mt-4 space-y-3">
              {overview?.secondary.map((metric) => (
                <div
                  key={metric.id}
                  className="flex items-center justify-between gap-3 rounded-[var(--kx-radius-md)] bg-surface-nested px-4 py-3"
                >
                  <dt className="type-meta text-ink-secondary">{metric.label}</dt>
                  <dd className="flex items-center gap-2">
                    <span className="type-numeric text-[0.9375rem] font-semibold text-ink">
                      {metric.display ?? metric.value}
                    </span>
                    {metric.deltaPercent ? (
                      <span
                        className={cn(
                          "type-numeric text-[0.75rem] font-medium",
                          metric.deltaPercent > 0
                            ? "text-success-500"
                            : "text-danger-500",
                        )}
                      >
                        {metric.deltaPercent > 0 ? "+" : ""}
                        {metric.deltaPercent.toFixed(1)}%
                      </span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card radius="xl" elevation="dark" className="border-white/8">
            <div className="flex items-start gap-3.5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-gold-400">
                <BadgeCheck className="size-4.5" strokeWidth={1.7} aria-hidden />
              </span>
              <div>
                <p className="type-card-title text-white">Verification queue</p>
                <p className="type-meta mt-1 text-white/60">
                  Six applications are waiting on a decision. Both tracks are
                  reviewed against the same standard.
                </p>
                <Link
                  href="/admin/verifications"
                  className="kx-tap type-meta mt-3 inline-flex items-center font-medium text-gold-400 underline-offset-4 hover:underline"
                >
                  Open the queue
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
