"use client";

import { useQuery } from "@tanstack/react-query";
import { Receipt as ReceiptIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ListSkeleton } from "@/components/ui/skeleton";
import { PageLoader } from "@/components/ui/route-loader";
import { PageHeader } from "@/components/layout/app-shell";
import { ReceiptCard } from "@/components/payments/receipt-card";
import { queryKeys } from "@/constants/query-keys";
import { useCurrentDriver } from "./use-current-driver";
import { rideService } from "@/services";
import { DriverTrack } from "@/types/enums";

/** Receipts issued for completed professional rides. */
export function DriverReceipts() {
  const { data: driver, isLoading: loadingDriver } = useCurrentDriver();

  const {
    data: receipts,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [...queryKeys.driver.root, "receipts"],
    queryFn: () => rideService.listReceipts(),
    enabled: driver?.track === DriverTrack.PROFESSIONAL,
  });

  if (loadingDriver) return <PageLoader message="Loading your receipts" />;

  if (driver?.track !== DriverTrack.PROFESSIONAL) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader eyebrow="Receipts" title="Not applicable" />
        <Card radius="xl">
          <EmptyState
            icon={ReceiptIcon}
            title="Volunteer journeys don't produce receipts."
            description="There's no fare to receipt. Your completed journeys are listed under Trips."
            action={
              <ButtonLink href="/driver/trips" variant="primary" size="md">
                View your trips
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Professional track"
        title="Receipts"
        description="One for every completed paid journey."
      />

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <ErrorState
          title="We couldn't load your receipts."
          onRetry={() => refetch()}
        />
      ) : !receipts || receipts.length === 0 ? (
        <Card radius="xl">
          <EmptyState
            icon={ReceiptIcon}
            title="No receipts yet."
            description="A receipt is issued each time a paid journey completes."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {receipts.map((receipt) => (
            <ReceiptCard key={receipt.id} receipt={receipt} />
          ))}
        </div>
      )}
    </div>
  );
}
