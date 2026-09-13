"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Route as RouteIcon } from "lucide-react";
import { Card, CardHeader, NestedTile } from "@/components/ui/card";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ListSkeleton } from "@/components/ui/skeleton";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { RatingValue } from "@/components/ui/rating";
import { PageHeader } from "@/components/layout/app-shell";
import { RideCard } from "@/components/rides/ride-card";
import { DestinationSearch } from "@/components/rides/destination-search";
import { queryKeys } from "@/constants/query-keys";
import { rideService } from "@/services";
import { useRideStore } from "@/stores/ride-store";
import { RIDE_STATUS_PRESENTATION } from "@/constants/status-presentation";
import { RideStatus } from "@/types/enums";
import { isRideActive, isRideTerminal } from "@/lib/state-machines";
import { shortName } from "@/lib/format";
import type { RideLocation } from "@/types/models";

type Tab = "ACTIVE" | "UPCOMING" | "COMPLETED" | "CANCELLED";

/**
 * The passenger's home.
 *
 * Requesting comes first — type a destination and you are already in the
 * request, with the journey chosen. History sits underneath, because looking
 * back is the second thing a member does here, not the first.
 */
export function RidesList() {
  const [chosenTab, setChosenTab] = useState<Tab | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.passenger.rides(),
    queryFn: () => rideService.listRides(),
  });

  const grouped = useMemo(() => {
    const rides = data ?? [];
    return {
      ACTIVE: rides.filter((ride) => isRideActive(ride.status)),
      // Awaiting payment or a rating still needs the passenger's attention.
      UPCOMING: rides.filter(
        (ride) =>
          ride.status === RideStatus.PAYMENT_PENDING ||
          ride.status === RideStatus.RATING_PENDING,
      ),
      COMPLETED: rides.filter(
        (ride) =>
          isRideTerminal(ride.status) && ride.status !== RideStatus.CANCELLED,
      ),
      CANCELLED: rides.filter((ride) => ride.status === RideStatus.CANCELLED),
    };
  }, [data]);

  const openRide = grouped.ACTIVE[0] ?? null;

  // A live journey opens on its own tab; otherwise history. Derived rather
  // than set in an effect, so it follows the data without a second render.
  const tab: Tab = chosenTab ?? (openRide ? "ACTIVE" : "COMPLETED");

  const empty: Record<Tab, { title: string; description: string }> = {
    ACTIVE: {
      title: "No journey in progress.",
      description: "When you're travelling, your live ride appears here.",
    },
    UPCOMING: {
      title: "Nothing needs your attention.",
      description:
        "Rides waiting on a payment or a rating would be listed here.",
    },
    COMPLETED: {
      title: "Your journeys will appear here.",
      description: "Every trip is kept with its route, driver and status.",
    },
    CANCELLED: {
      title: "No cancelled journeys.",
      description: "Rides cancelled before they started are listed here.",
    },
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Rides"
        title="Your rides"
        description="Start a journey, or look back at one."
      />

      <QuickRequest />

      {openRide ? (
        <Card radius="xl" className="mt-5">
          <CardHeader
            eyebrow="Journey in progress"
            title={openRide.destination.label}
            action={
              <StatusBadge
                presentation={RIDE_STATUS_PRESENTATION[openRide.status]}
                live
              />
            }
          />

          {openRide.driver ? (
            <NestedTile className="mt-5 flex items-center gap-3.5">
              <Avatar
                name={openRide.driver.fullName}
                src={openRide.driver.avatarUrl}
                size="md"
                verified
              />
              <div className="min-w-0 flex-1">
                <p className="type-card-title truncate text-ink">
                  {shortName(openRide.driver.fullName)}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <RatingValue value={openRide.driver.rating} />
                  <span className="type-meta truncate text-ink-secondary">
                    {openRide.driver.vehicle.colour}{" "}
                    {openRide.driver.vehicle.make}{" "}
                    {openRide.driver.vehicle.model}
                  </span>
                </div>
              </div>
              <span className="type-numeric shrink-0 rounded-[var(--kx-radius-xs)] bg-surface px-2.5 py-1.5 text-[0.8125rem] font-semibold text-ink ring-1 ring-line">
                {openRide.driver.vehicle.plateNumber}
              </span>
            </NestedTile>
          ) : null}

          <ButtonLink
            href="/passenger/trip"
            variant="primary"
            size="lg"
            block
            className="mt-4"
            iconRight={ArrowRight}
          >
            Open live journey
          </ButtonLink>
        </Card>
      ) : null}

      <Tabs
        label="Ride status"
        value={tab}
        onChange={setChosenTab}
        className="mt-6 mb-5"
        items={[
          {
            value: "ACTIVE" as Tab,
            label: "Active",
            count: grouped.ACTIVE.length,
          },
          {
            value: "UPCOMING" as Tab,
            label: "Needs action",
            count: grouped.UPCOMING.length,
          },
          {
            value: "COMPLETED" as Tab,
            label: "Completed",
            count: grouped.COMPLETED.length,
          },
          {
            value: "CANCELLED" as Tab,
            label: "Cancelled",
            count: grouped.CANCELLED.length,
          },
        ]}
      />

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <ErrorState
          title="We couldn't load your rides."
          description="Your history is safe — this is just a problem fetching it."
          onRetry={() => refetch()}
        />
      ) : (
        (["ACTIVE", "UPCOMING", "COMPLETED", "CANCELLED"] as Tab[]).map(
          (value) => (
            <TabPanel key={value} active={tab === value}>
              {grouped[value].length === 0 ? (
                <Card radius="xl">
                  <EmptyState
                    icon={RouteIcon}
                    size="sm"
                    title={empty[value].title}
                    description={empty[value].description}
                  />
                </Card>
              ) : (
                <div className="space-y-3">
                  {grouped[value].map((ride) => (
                    <RideCard
                      key={ride.id}
                      ride={ride}
                      href={`/passenger/rides/${ride.id}`}
                    />
                  ))}
                </div>
              )}
            </TabPanel>
          ),
        )
      )}
    </div>
  );
}

/**
 * One field, one tap.
 *
 * Choosing a destination here carries it into the request screen, so the
 * member lands there with the journey already set and only the track and
 * ride type left to confirm.
 */
function QuickRequest() {
  const router = useRouter();
  const destination = useRideStore((state) => state.destination);
  const setDestination = useRideStore((state) => state.setDestination);
  const setEstimate = useRideStore((state) => state.setEstimate);

  function choose(location: RideLocation) {
    setDestination(location);
    router.push("/passenger/request");
  }

  return (
    <Card radius="xl">
      <CardHeader
        eyebrow="Request a ride"
        title="Where to?"
        description="We'll find a driver near you. Choose volunteer or professional on the next screen."
      />

      <div className="mt-5">
        <DestinationSearch
          value={destination}
          onSelect={choose}
          onClear={() => {
            setDestination(null);
            setEstimate(null, null);
          }}
        />
      </div>

      <ButtonLink
        href="/passenger/request"
        variant="primary"
        size="lg"
        block
        className="mt-4"
        iconRight={ArrowRight}
      >
        Request a ride
      </ButtonLink>
    </Card>
  );
}
