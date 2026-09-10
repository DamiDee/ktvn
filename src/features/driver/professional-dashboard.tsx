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
import { Button, ButtonLink } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/badge";
import { StatsCard, Sparkline } from "@/components/ui/stats-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/app-shell";
import { RequestCard } from "@/components/drivers/request-card";
import { queryKeys } from "@/constants/query-keys";
import { rideService } from "@/services";
import { DriverAvailability, DriverTrack, RideType } from "@/types/enums";
import { formatNaira, greetingForHour } from "@/lib/format";
import { goingOfflineNeedsConfirmation } from "@/lib/state-machines";
import type { Driver } from "@/types/models";

/**
 * Professional dashboard. Operational and financial in tone — but earnings
 * are a record of completed rides, never a wallet balance.
 */
export function ProfessionalDashboard({ driver }: { driver: Driver }) {
  const { toast } = useToast();
  const [availability, setAvailability] = useState<DriverAvailability>(
    driver.availability,
  );
  const [rideType, setRideType] = useState<RideType>(RideType.SHARED);
  const [confirmOffline, setConfirmOffline] = useState(false);

  const { data: requests, isLoading } = useQuery({
    queryKey: queryKeys.driver.requests(DriverTrack.PROFESSIONAL),
    queryFn: () => rideService.listRequests(DriverTrack.PROFESSIONAL),
  });

  const online = availability !== DriverAvailability.OFFLINE;
  const earnings = driver.earningsSummary;
  const firstName = driver.fullName.split(" ")[0];

  function goOffline() {
    setAvailability(DriverAvailability.OFFLINE);
    setConfirmOffline(false);
    toast({ title: "You're offline", description: "You won't receive new requests." });
  }

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
          {/* Online control */}
          <Card radius="xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <span className="relative flex size-3 shrink-0">
                  {online ? (
                    <span
                      className="absolute inline-flex size-full rounded-full bg-success-500"
                      style={{ animation: "kx-pulse-ring 2.2s ease-out infinite" }}
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={`relative inline-flex size-3 rounded-full ${online ? "bg-success-500" : "bg-ink-muted"}`}
                  />
                </span>
                <div>
                  <p className="type-section-title text-ink">
                    {online ? "You're online" : "You're offline"}
                  </p>
                  <p className="type-meta mt-0.5 text-ink-secondary">
                    {online
                      ? "Requests along your route will reach you."
                      : "Members can't see you or send you requests."}
                  </p>
                </div>
              </div>

              <Button
                variant={online ? "subtle" : "primary"}
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => {
                  if (online) {
                    if (goingOfflineNeedsConfirmation(availability)) {
                      setConfirmOffline(true);
                    } else {
                      goOffline();
                    }
                  } else {
                    setAvailability(DriverAvailability.AVAILABLE);
                    toast({
                      title: "You're online",
                      description: "Set a destination to receive matched requests.",
                      tone: "success",
                    });
                  }
                }}
              >
                {online ? "Go Offline" : "Go Online"}
              </Button>
            </div>

            <div className="mt-5 border-t border-line pt-5">
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
            </div>
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

      <ConfirmDialog
        open={confirmOffline}
        onClose={() => setConfirmOffline(false)}
        onConfirm={goOffline}
        title="Go offline now?"
        description="You have an active availability. Going offline removes you from matching and cancels any requests still waiting on your reply."
        confirmLabel="Go offline"
        cancelLabel="Stay online"
        tone="danger"
      />
    </div>
  );
}
