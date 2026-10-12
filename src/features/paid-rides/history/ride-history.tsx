"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, History, Star } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ERROR_COPY, toRideError } from "../domain/errors";
import { formatDistance, formatDuration, formatMoney } from "../domain/format";
import { isLive } from "../domain/ride-status";
import type { RideSummary } from "../domain/types";
import { getRideService } from "../services";
import { PageSection, RidePage } from "../components/ride-page";
import { MetricRow, RouteStops, VehicleIllustration } from "../components/ride-ui";
import { usePassengerStore } from "../state/passenger-store";

/**
 * Ride history and ride detail for both roles. Server data via TanStack
 * Query; the detail page reads the same list (cached) so opening a past trip
 * is instant and works offline once loaded.
 */

type Role = "passenger" | "driver";

export function historyQueryKey(role: Role) {
  return ["paid-rides", "history", role] as const;
}

function useHistory(role: Role) {
  return useQuery({
    queryKey: historyQueryKey(role),
    queryFn: ({ signal }) => (role === "driver" ? getRideService().getDriverHistory(null, signal) : getRideService().getRideHistory(null, signal)),
    staleTime: 30_000,
  });
}

const STATUS_TEXT: Partial<Record<RideSummary["status"], string>> = {
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_DRIVERS: "No driver found",
};

function dateText(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function RideHistory({ role }: { role: Role }) {
  const history = useHistory(role);
  const liveRide = usePassengerStore((store) => (role === "passenger" && store.session.ride && isLive(store.session.ride.status) ? store.session.ride : null));
  const base = role === "driver" ? "/rides/driver/trips" : "/rides";

  return (
    <RidePage title={role === "driver" ? "Trips" : "Activity"} subtitle={role === "driver" ? "Your completed and cancelled trips." : "Your past rides and receipts."}>
      {liveRide ? (
        <Link href="/rides" className="ride-press mb-6 flex items-center gap-3 rounded-[var(--ride-radius-lg)] bg-[var(--ride-primary)] p-4 text-[var(--ride-on-primary)]">
          <span className="relative flex size-3">
            <span className="ride-pulse-ring absolute -inset-1.5 rounded-full bg-current opacity-40" />
            <span className="relative size-3 rounded-full bg-current" />
          </span>
          <span className="flex-1">
            <span className="ride-body block font-semibold">Ride in progress</span>
            <span className="ride-body-sm block opacity-80">To {liveRide.destination.name}</span>
          </span>
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      ) : null}

      {history.isPending ? (
        <div className="space-y-3" aria-busy aria-label="Loading trips">
          {[0, 1, 2].map((row) => (
            <div key={row} className="kx-skeleton h-24 w-full !rounded-[var(--ride-radius-lg)]" />
          ))}
        </div>
      ) : history.isError ? (
        <ErrorState title={ERROR_COPY[toRideError(history.error).code].title} description={ERROR_COPY[toRideError(history.error).code].body} onRetry={() => void history.refetch()} />
      ) : history.data.items.length === 0 ? (
        <EmptyState
          icon={History}
          title={role === "driver" ? "No trips yet" : "No rides yet"}
          description={role === "driver" ? "Go online to receive your first request." : "Your trips and receipts will appear here."}
          action={<ButtonLink href={role === "driver" ? "/rides/driver" : "/rides"}>{role === "driver" ? "Start driving" : "Book a ride"}</ButtonLink>}
        />
      ) : (
        <ul className="space-y-2.5">
          {history.data.items.map((item) => (
            <li key={item.id}>
              <Link href={`${base}/${encodeURIComponent(item.id)}`} className="ride-press flex items-center gap-4 rounded-[var(--ride-radius-lg)] bg-[var(--surface-primary)] p-4 shadow-[var(--kx-shadow-xs)]">
                <VehicleIllustration vehicleClass={item.vehicleClass} className="h-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="ride-body truncate font-semibold">{item.destinationName}</p>
                  <p className="ride-caption truncate">
                    {dateText(item.createdAt)} · {STATUS_TEXT[item.status] ?? item.optionName}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="ride-num font-semibold">{item.total ? formatMoney(item.total) : "—"}</p>
                  {item.ratingGiven ? (
                    <p className="ride-caption inline-flex items-center gap-0.5">
                      <Star className="size-3 fill-[var(--kx-gold-500)] text-[var(--kx-gold-500)]" aria-hidden />
                      {item.ratingGiven}
                      <span className="sr-only"> stars given</span>
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </RidePage>
  );
}

export function RideDetail({ role, rideId }: { role: Role; rideId: string }) {
  const history = useHistory(role);
  const liveRide = usePassengerStore((store) => (store.session.ride?.id === rideId ? store.session.ride : null));
  const item = history.data?.items.find((entry) => entry.id === rideId);
  const back = role === "driver" ? "/rides/driver/trips" : "/rides/history";

  if (role === "passenger" && liveRide && isLive(liveRide.status)) {
    return (
      <RidePage title="Ride in progress" backHref={back}>
        <ButtonLink href="/rides" block size="lg" pill>
          Return to your trip
        </ButtonLink>
      </RidePage>
    );
  }

  if (history.isPending) {
    return (
      <RidePage title="Trip" backHref={back}>
        <div className="kx-skeleton h-64 w-full !rounded-[var(--ride-radius-lg)]" aria-busy />
      </RidePage>
    );
  }

  if (!item) {
    return (
      <RidePage title="Trip" backHref={back}>
        <EmptyState icon={History} title="We couldn't find that trip" description="It may be older than your history shows." />
      </RidePage>
    );
  }

  return (
    <RidePage title={item.destinationName} subtitle={dateText(item.createdAt)} backHref={back}>
      <PageSection>
        <div className="space-y-5 rounded-[var(--ride-radius-lg)] bg-[var(--surface-primary)] p-5 shadow-[var(--kx-shadow-xs)]">
          <div className="flex items-baseline justify-between">
            <p className="ride-label">{role === "driver" ? "You earned" : STATUS_TEXT[item.status] ?? "Total"}</p>
            <p className="ride-num text-[1.75rem] font-semibold tracking-[-0.03em]">{item.total ? formatMoney(item.total) : "—"}</p>
          </div>
          <RouteStops pickup={{ name: item.pickupName }} destination={{ name: item.destinationName }} />
          <MetricRow
            items={[
              { label: "Distance", value: formatDistance(item.distanceMeters) },
              { label: "Time", value: item.durationSeconds ? formatDuration(item.durationSeconds) : "—" },
              { label: "Ride", value: item.optionName },
            ]}
          />
          {item.counterpartName ? (
            <p className="ride-body-sm text-[var(--text-secondary)]">
              {role === "driver" ? "Rider" : "Driver"}: <span className="font-semibold text-[var(--text-primary)]">{item.counterpartName}</span>
              {item.ratingGiven ? ` · you rated ${item.ratingGiven}★` : ""}
            </p>
          ) : null}
        </div>
      </PageSection>
      <PageSection title="Need help with this trip?">
        <Link href="/rides/safety" className="ride-press flex items-center justify-between rounded-[var(--ride-radius-lg)] bg-[var(--surface-primary)] p-4 shadow-[var(--kx-shadow-xs)]">
          <span className="ride-body font-semibold">Report an issue or lost item</span>
          <ChevronRight className="size-4 text-[var(--text-tertiary)]" aria-hidden />
        </Link>
      </PageSection>
    </RidePage>
  );
}
