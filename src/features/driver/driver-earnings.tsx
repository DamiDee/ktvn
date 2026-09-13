"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Info, Receipt, Star, TrendingUp, Users } from "lucide-react";
import { Card, CardHeader, NestedTile } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StatsCard } from "@/components/ui/stats-card";
import { StatusBadge, StatusChip } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { StatsCardSkeleton, ListSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/app-shell";
import { BarChart } from "@/components/analytics/bar-chart";
import { queryKeys } from "@/constants/query-keys";
import { useCurrentDriver } from "./use-current-driver";
import { rideService } from "@/services";
import { PAYMENT_PRESENTATION, RIDE_TYPE_LABEL } from "@/constants/status-presentation";
import { DriverTrack } from "@/types/enums";
import { formatDate, formatNaira } from "@/lib/format";
import { PageLoader } from "@/components/ui/route-loader";

/**
 * Professional earnings.
 *
 * A record of completed rides — deliberately not a wallet. There is no
 * balance, no withdrawal, no top-up, and the copy says so plainly.
 */
export function DriverEarnings() {
  const { data: driver, isLoading: loadingDriver } = useCurrentDriver();

  const {
    data: earnings,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [...queryKeys.driver.root, "earnings"],
    queryFn: () => rideService.listEarnings(),
    enabled: driver?.track === DriverTrack.PROFESSIONAL,
  });

  if (loadingDriver) return <PageLoader message="Loading your earnings" />;

  // Product Rule 1: a volunteer driver has no earnings surface at all.
  if (driver?.track !== DriverTrack.PROFESSIONAL) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader eyebrow="Earnings" title="Not applicable" />
        <Card radius="xl">
          <EmptyState
            icon={Users}
            title="Volunteer journeys don't have earnings."
            description="You drive in service, so there's no fare and nothing to settle. Your service record lives under Recognition instead."
            action={
              <ButtonLink
                href="/driver/volunteer/recognition"
                variant="primary"
                size="md"
              >
                View recognition
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  const summary = driver.earningsSummary;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Professional track"
        title="Your earnings"
        description="What your completed rides have come to this week."
        action={
          <ButtonLink
            href="/driver/professional/receipts"
            variant="secondary"
            size="md"
            icon={Receipt}
          >
            View All Receipts
          </ButtonLink>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {loadingDriver ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <StatsCard
              label="This week"
              value={formatNaira(summary?.weekToDate ?? 0)}
              icon={TrendingUp}
              accent="lilac"
            />
            <StatsCard
              label="Trips"
              value={summary?.weekTrips ?? 0}
              numericValue={summary?.weekTrips ?? 0}
              icon={Users}
              accent="forest"
            />
            <StatsCard
              label="Avg rating"
              value={(summary?.averageRating ?? 0).toFixed(1)}
              icon={Star}
              accent="gold"
            />
          </>
        )}
      </div>

      {/* Chart */}
      <Card radius="xl" className="mt-5">
        <CardHeader
          title="This week"
          description="Completed rides, day by day."
        />
        {summary ? (
          <BarChart
            className="mt-6"
            accent="lilac"
            caption="Earnings by day this week"
            formatValue={formatNaira}
            data={summary.dailySeries.map((day) => ({
              label: day.label,
              value: day.amount,
            }))}
          />
        ) : null}

        {summary?.lastPayoutAt ? (
          <p className="type-meta mt-5 flex items-start gap-1.5 text-ink-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
            Last settled {formatDate(summary.lastPayoutAt)}. This is a record of
            completed rides, not a wallet — nothing is held here and nothing can
            be spent from it.
          </p>
        ) : null}
      </Card>

      {/* Recent trips */}
      <Card radius="xl" className="mt-5">
        <CardHeader
          title="Recent trips"
          description="Each completed ride and how it settled."
          action={
            <Link
              href="/driver/trips"
              className="kx-tap type-meta inline-flex items-center font-medium text-forest-700 underline-offset-4 hover:underline dark:text-gold-300"
            >
              All trips
            </Link>
          }
        />

        <div className="mt-5">
          {isLoading ? (
            <ListSkeleton rows={3} />
          ) : isError ? (
            <ErrorState
              title="We couldn't load these trips."
              onRetry={() => refetch()}
            />
          ) : !earnings || earnings.length === 0 ? (
            <EmptyState
              icon={Receipt}
              size="sm"
              title="Your completed professional rides will appear here."
              description="Each one shows the fare and whether it has settled."
            />
          ) : (
            <ul className="space-y-2.5">
              {earnings.map((earning) => (
                <li key={earning.id}>
                  <NestedTile className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="type-body truncate font-medium text-ink">
                        {earning.destinationLabel}
                        <span className="ml-2 text-ink-muted">
                          · {RIDE_TYPE_LABEL[earning.rideType]}
                        </span>
                      </p>
                      <p className="type-meta mt-0.5 truncate text-ink-muted">
                        <span className="type-numeric">
                          {earning.rideReference}
                        </span>{" "}
                        · {formatDate(earning.date)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="type-numeric text-[0.875rem] font-semibold text-ink">
                        {formatNaira(earning.amount)}
                      </span>
                      <StatusBadge
                        presentation={PAYMENT_PRESENTATION[earning.paymentStatus]}
                        dot={false}
                      />
                    </div>
                  </NestedTile>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <div className="mt-5 flex items-start gap-3 rounded-[var(--kx-radius-md)] border border-line bg-surface-nested p-4">
        <StatusChip tone="professional" className="shrink-0">
          Note
        </StatusChip>
        <p className="type-meta text-ink-secondary">
          Earnings here are a record of what your completed rides came to. The
          network doesn&rsquo;t hold a balance for you, and settlement happens
          outside the app.
        </p>
      </div>
    </div>
  );
}
