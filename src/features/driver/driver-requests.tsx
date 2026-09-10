"use client";

import { useQuery } from "@tanstack/react-query";
import { Inbox, MapPin, Radar } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/app-shell";
import { RequestCard } from "@/components/drivers/request-card";
import { PageLoader } from "@/components/ui/route-loader";
import { queryKeys } from "@/constants/query-keys";
import { useCurrentDriver } from "./use-current-driver";
import { rideService } from "@/services";
import {
  DRIVER_AVAILABILITY_PRESENTATION,
  TRACK_LABEL,
} from "@/constants/status-presentation";
import { isDriverOnline } from "@/lib/state-machines";

/**
 * The driver's request inbox.
 *
 * `RequestCard` renders a fare only on the professional track, so this one
 * screen serves both without a money-related branch here.
 */
export function DriverRequests() {
  const { data: driver, isLoading: loadingDriver } = useCurrentDriver();

  const {
    data: requests,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.driver.requests(driver?.track ?? "none"),
    queryFn: () => rideService.listRequests(driver!.track),
    enabled: Boolean(driver),
  });

  if (loadingDriver || !driver) {
    return <PageLoader message="Loading your requests" />;
  }

  const online = isDriverOnline(driver.availability);
  const availability = DRIVER_AVAILABILITY_PRESENTATION[driver.availability];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={`${TRACK_LABEL[driver.track]} track`}
        title="Ride requests"
        description="Members heading in your direction. Requests expire, so respond while the countdown runs."
        action={
          <StatusChip
            tone={availability.tone === "active" ? "active" : "neutral"}
            dot
            live={online}
            size="md"
          >
            {availability.label}
          </StatusChip>
        }
      />

      {!online ? (
        <Card radius="xl">
          <EmptyState
            icon={Radar}
            title="You're offline."
            description="Set a destination and go online to start receiving requests from members heading your way."
            action={
              <ButtonLink
                href="/driver/destination"
                variant="primary"
                size="md"
                icon={MapPin}
              >
                Set your destination
              </ButtonLink>
            }
          />
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          <div className="kx-skeleton h-56 rounded-[var(--kx-radius-lg)]" />
          <div className="kx-skeleton h-56 rounded-[var(--kx-radius-lg)]" />
        </div>
      ) : isError ? (
        <ErrorState
          title="We couldn't load your requests."
          description="You're still online — this is just a problem fetching the list."
          onRetry={() => refetch()}
        />
      ) : !requests || requests.length === 0 ? (
        <Card radius="xl">
          <EmptyState
            icon={Inbox}
            title="No requests right now."
            description="When a member is heading your way, their request appears here with the detour it would add to your route."
          />
        </Card>
      ) : (
        <Card radius="xl">
          <CardHeader
            title={`${requests.length} waiting`}
            description="Accepting a request adds the passenger to your journey."
            action={
              <StatusChip tone="pending" dot live>
                Live
              </StatusChip>
            }
          />
          <div className="mt-5 space-y-3">
            {requests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
