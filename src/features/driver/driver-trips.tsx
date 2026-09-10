"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Route as RouteIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ListSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/app-shell";
import { DriverTripCard } from "@/components/drivers/driver-trip-card";
import { queryKeys } from "@/constants/query-keys";
import { useCurrentDriver } from "./use-current-driver";
import { rideService } from "@/services";
import { DriverTrack, RideStatus } from "@/types/enums";
import { isRideActive, isRideTerminal } from "@/lib/state-machines";

type Tab = "ACTIVE" | "COMPLETED" | "CANCELLED";
type TrackFilter = "ALL" | DriverTrack;

/**
 * Driver trip history.
 *
 * The track filter only appears for a driver who actually has history on both
 * tracks — most drivers never see it.
 */
export function DriverTrips() {
  const [tab, setTab] = useState<Tab>("ACTIVE");
  const [trackFilter, setTrackFilter] = useState<TrackFilter>("ALL");

  const { data: driver } = useCurrentDriver();

  const {
    data: trips,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [...queryKeys.driver.root, "trips"],
    queryFn: () => rideService.listDriverTrips(),
  });

  const hasBothTracks = useMemo(() => {
    if (!trips) return false;
    return (
      trips.some((trip) => trip.track === DriverTrack.VOLUNTEER) &&
      trips.some((trip) => trip.track === DriverTrack.PROFESSIONAL)
    );
  }, [trips]);

  const byTrack = useMemo(() => {
    if (!trips) return [];
    return trackFilter === "ALL"
      ? trips
      : trips.filter((trip) => trip.track === trackFilter);
  }, [trips, trackFilter]);

  const grouped = useMemo(() => {
    const active = byTrack.filter((trip) => isRideActive(trip.status));
    const cancelled = byTrack.filter(
      (trip) => trip.status === RideStatus.CANCELLED,
    );
    const completed = byTrack.filter(
      (trip) =>
        isRideTerminal(trip.status) && trip.status !== RideStatus.CANCELLED,
    );
    return { active, completed, cancelled };
  }, [byTrack]);

  const emptyCopy: Record<Tab, { title: string; description: string }> = {
    ACTIVE: {
      title: "No journey in progress.",
      description:
        "Set a destination and go online to start receiving requests.",
    },
    COMPLETED: {
      title: "Your completed journeys will appear here.",
      description:
        "Every trip is kept with its route, passengers and outcome.",
    },
    CANCELLED: {
      title: "No cancelled journeys.",
      description: "Trips cancelled before they started are listed here.",
    },
  };

  const listFor: Record<Tab, typeof grouped.active> = {
    ACTIVE: grouped.active,
    COMPLETED: grouped.completed,
    CANCELLED: grouped.cancelled,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="History"
        title="Your trips"
        description="Every journey you've driven, with the passengers who travelled with you."
      />

      {hasBothTracks ? (
        <div className="mb-5">
          <p className="type-micro mb-2.5 text-ink-muted">Track</p>
          <SegmentedControl
            label="Filter by track"
            value={trackFilter}
            onChange={setTrackFilter}
            options={[
              { value: "ALL" as TrackFilter, label: "All" },
              { value: DriverTrack.VOLUNTEER as TrackFilter, label: "Volunteer" },
              {
                value: DriverTrack.PROFESSIONAL as TrackFilter,
                label: "Professional",
              },
            ]}
          />
        </div>
      ) : null}

      <Tabs
        label="Trip status"
        value={tab}
        onChange={setTab}
        className="mb-5"
        items={[
          { value: "ACTIVE" as Tab, label: "Active", count: grouped.active.length },
          {
            value: "COMPLETED" as Tab,
            label: "Completed",
            count: grouped.completed.length,
          },
          {
            value: "CANCELLED" as Tab,
            label: "Cancelled",
            count: grouped.cancelled.length,
          },
        ]}
      />

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <ErrorState
          title="We couldn't load your trips."
          description="Your history is safe — this is just a problem fetching it."
          onRetry={() => refetch()}
        />
      ) : (
        (["ACTIVE", "COMPLETED", "CANCELLED"] as Tab[]).map((value) => (
          <TabPanel key={value} active={tab === value}>
            {listFor[value].length === 0 ? (
              <Card radius="xl">
                <EmptyState
                  icon={RouteIcon}
                  size="sm"
                  title={emptyCopy[value].title}
                  description={emptyCopy[value].description}
                />
              </Card>
            ) : (
              <div className="space-y-3">
                {listFor[value].map((trip) => (
                  <DriverTripCard key={trip.id} trip={trip} />
                ))}
              </div>
            )}
          </TabPanel>
        ))
      )}

      {driver?.track === DriverTrack.VOLUNTEER ? (
        <p className="type-meta mt-6 text-center text-ink-muted">
          Volunteer journeys are given in service — they carry no fare and no
          payment.
        </p>
      ) : null}
    </div>
  );
}
