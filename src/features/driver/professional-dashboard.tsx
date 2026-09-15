"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Inbox,
  MapPin,
  Receipt,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardHeader, NestedTile } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/badge";
import { StatsCard, Sparkline } from "@/components/ui/stats-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/app-shell";
import { RequestCard } from "@/components/drivers/request-card";
import { DriverOnlineControl } from "@/components/drivers/driver-online-control";
import { InspectionCountdownCard } from "@/components/drivers/inspection-countdown-card";
import { queryKeys } from "@/constants/query-keys";
import { rideService } from "@/services";
import { DriverTrack, RideType } from "@/types/enums";
import { formatNaira, greetingForHour } from "@/lib/format";
import { useSessionStore } from "@/stores/session-store";
import type { Driver } from "@/types/models";

/**
 * Professional dashboard. Operational and financial in tone — but earnings
 * are a record of completed rides, never a wallet balance.
 */
export function ProfessionalDashboard({ driver }: { driver: Driver }) {
  const [rideType, setRideType] = useState<RideType>(RideType.SHARED);
  const online = useSessionStore((state) => state.driverOnline);

  const { data: requests, isLoading } = useQuery({
    queryKey: queryKeys.driver.requests(DriverTrack.PROFESSIONAL),
    queryFn: () => rideService.listRequests(DriverTrack.PROFESSIONAL),
  });

  const earnings = driver.earningsSummary;
  const firstName = driver.fullName.split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={greetingForHour()}
        title={`${greetingForHour()}, ${firstName}.`}
        description={
          online
            ? "You're visible to members heading your way."
            : "Go online to start receiving requests."
        }
        action={
          <ButtonLink href="/driver/destination" variant="secondary" size="lg" pill icon={MapPin}>
            Set destination
          </ButtonLink>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <DriverOnlineControl driver={driver} />

          <Card radius="xl">
            <p className="type-micro mb-3 text-ink-muted">Ride types you accept</p>
            <SegmentedControl
              label="Ride types you accept"
              value={rideType}
              onChange={setRideType}
              options={[
                { value: RideType.PRIVATE, label: "Private" },
                { value: RideType.SHARED, label: "Shared" },
              ]}
            />
            <p className="type-meta mt-3 text-ink-muted">
              {rideType === RideType.SHARED
                ? "Up to 3 passengers travelling the same way."
                : "One passenger or group, direct to their destination."}
            </p>
          </Card>

          {/* Requests */}
          <Card radius="xl">
            <CardHeader
              title="Ride requests"
              description="Members heading in your direction."
              action={
                requests && requests.length > 0 && online ? (
                  <StatusChip tone="pending" dot live>
                    {requests.length} waiting
                  </StatusChip>
                ) : null
              }
            />

            <div className="mt-5 space-y-3">
              {!online ? (
                <EmptyState
                  icon={Inbox}
                  size="sm"
                  title="You're offline."
                  description="Go online to start receiving ride requests."
                />
              ) : isLoading ? (
                <div className="kx-skeleton h-36 rounded-[var(--kx-radius-lg)]" />
              ) : !requests || requests.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  size="sm"
                  title="No requests right now."
                  description="Setting a destination helps match you with members going the same way."
                />
              ) : (
                requests.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <InspectionCountdownCard inspection={driver.inspection} />

          {/* Earnings summary */}
          <div className="grid grid-cols-2 gap-3">
            <StatsCard
              label="This week"
              value={formatNaira(earnings?.weekToDate ?? 0)}
              icon={TrendingUp}
              accent="lilac"
              className="col-span-2"
              sparkline={earnings?.dailySeries.map((day) => day.amount)}
            />
            <StatsCard
              label="Trips"
              value={earnings?.weekTrips ?? 0}
              numericValue={earnings?.weekTrips ?? 0}
              icon={Users}
              accent="forest"
            />
            <StatsCard
              label="Avg rating"
              value={(earnings?.averageRating ?? 0).toFixed(1)}
              icon={Star}
              accent="gold"
            />
          </div>

          <Card radius="xl">
            <CardHeader
              title="This week"
              description="Completed professional rides."
            />

            <Sparkline
              values={earnings?.dailySeries.map((day) => day.amount) ?? []}
              accent="lilac"
              className="mt-4 h-14"
            />

            <div className="mt-4 space-y-2">
              {(earnings?.dailySeries ?? []).slice(-3).map((day) => (
                <NestedTile
                  key={day.label}
                  className="flex items-center justify-between py-2.5"
                >
                  <span className="type-meta text-ink-secondary">{day.label}</span>
                  <span className="type-numeric text-[0.875rem] font-semibold text-ink">
                    {formatNaira(day.amount)}
                  </span>
                </NestedTile>
              ))}
            </div>

            <ButtonLink
              href="/driver/professional/receipts"
              variant="secondary"
              size="sm"
              block
              className="mt-4"
              icon={Receipt}
            >
              View all receipts
            </ButtonLink>

            <p className="type-meta mt-3 text-ink-muted">
              Earnings are a record of completed rides. They aren&rsquo;t a
              wallet and can&rsquo;t be spent inside the app.
            </p>
          </Card>
        </div>
      </div>

    </div>
  );
}
