"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Route as RouteIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ListSkeleton } from "@/components/ui/skeleton";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/app-shell";
import { RideCard } from "@/components/rides/ride-card";
import { queryKeys } from "@/constants/query-keys";
import { rideService } from "@/services";
import { RideStatus } from "@/types/enums";
import { isRideActive, isRideTerminal } from "@/lib/state-machines";

type Tab = "ACTIVE" | "UPCOMING" | "COMPLETED" | "CANCELLED";

export function RidesList() {
  const [tab, setTab] = useState<Tab>("COMPLETED");

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
      description:
        "Every trip is kept with its route, driver and status.",
    },
    CANCELLED: {
      title: "No cancelled journeys.",
      description: "Rides cancelled before they started are listed here.",
    },
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="History"
        title="Your rides"
        description="Every journey you've taken across both tracks."
        action={
          <ButtonLink href="/passenger/request" variant="primary" size="md" pill>
            Request a ride
          </ButtonLink>
        }
      />

      <Tabs
        label="Ride status"
        value={tab}
        onChange={setTab}
        className="mb-5"
        items={[
          { value: "ACTIVE" as Tab, label: "Active", count: grouped.ACTIVE.length },
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
