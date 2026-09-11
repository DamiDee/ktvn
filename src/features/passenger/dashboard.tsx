"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarClock,
  LifeBuoy,
  Route as RouteIcon,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { Card, CardHeader, DataPoint, NestedTile } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge, StatusChip, VerifiedBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { RatingValue } from "@/components/ui/rating";
import { EmptyState } from "@/components/ui/states";
import { RideCardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/app-shell";
import { RideCard } from "@/components/rides/ride-card";
import { DestinationSearch } from "@/components/rides/destination-search";
import { queryKeys } from "@/constants/query-keys";
import { rideService, userService } from "@/services";
import {
  MEMBERSHIP_PRESENTATION,
  RIDE_STATUS_PRESENTATION,
} from "@/constants/status-presentation";
import {
  greetingForHour,
  formatDate,
  formatTime,
  shortName,
} from "@/lib/format";
import { isRideTerminal } from "@/lib/state-machines";
import { MembershipStatus } from "@/types/enums";
import { LOCATIONS } from "@/mocks/locations";
import { DEFAULT_PICKUP_ZONE } from "@/mocks/pickup-zones";
import { useRideStore } from "@/stores/ride-store";
import { useSafetyStore } from "@/stores/safety-store";
import type { RideLocation } from "@/types/models";

export function PassengerDashboard() {
  const router = useRouter();
  const resetRide = useRideStore((state) => state.reset);
  const setDestination = useRideStore((state) => state.setDestination);
  const setPickupZone = useRideStore((state) => state.setPickupZone);
  const setDeparturePlan = useRideStore((state) => state.setDeparturePlan);
  const autoShare = useSafetyStore((state) => state.autoShare);
  const selectedContactIds = useSafetyStore((state) => state.selectedContactIds);
  const { data: passenger, isLoading: loadingPassenger } = useQuery({
    queryKey: queryKeys.passenger.profile(),
    queryFn: () => userService.getCurrentPassenger(),
  });

  const { data: rides, isLoading: loadingRides } = useQuery({
    queryKey: queryKeys.passenger.rides(),
    queryFn: () => rideService.listRides(),
  });

  const { data: event } = useQuery({
    queryKey: queryKeys.passenger.event(),
    queryFn: () => rideService.getUpcomingEvent(),
  });

  const openRide = rides?.find((ride) => !isRideTerminal(ride.status));
  const recentRides = rides?.slice(0, 3) ?? [];
  const recentDrivers = (rides ?? [])
    .map((ride) => ride.driver)
    .filter((driver): driver is NonNullable<typeof driver> => Boolean(driver))
    .slice(0, 3);

  const firstName = passenger?.fullName.split(" ")[0] ?? "there";
  const homeDestination =
    Object.values(LOCATIONS).find(
      (location) => location.area === passenger?.homeArea,
    ) ?? LOCATIONS.gwarinpa;

  function beginRequest(location: RideLocation) {
    resetRide();
    setPickupZone(DEFAULT_PICKUP_ZONE);
    setDeparturePlan("AFTER_EVENT");
    setDestination(location);
    router.push("/passenger/request");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={greetingForHour()}
        title={
          loadingPassenger ? (
            <Skeleton className="h-9 w-64 rounded-lg" />
          ) : (
            `${greetingForHour()}, ${firstName}.`
          )
        }
        description="Where are you heading today?"
        action={
          <ButtonLink
            href="/passenger/request"
            variant="primary"
            size="lg"
            pill
            iconRight={ArrowRight}
          >
            Request a ride
          </ButtonLink>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          {/* Event-aware ride composer */}
          <Card radius="xl" className="z-20 p-0">
            <div className="rounded-t-[var(--kx-radius-xl)] bg-forest-900 p-5 text-white sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="type-micro text-white/45">Plan for your next gathering</p>
                  <h2 className="type-section-title mt-2 text-white">
                    {event?.name ?? "Sunday Service"}
                  </h2>
                  <p className="type-meta mt-1.5 text-white/60">
                    {event
                      ? `${formatDate(event.startsAt)} · ends ${formatTime(event.endsAt)}`
                      : "Koinonia Centre · Lugbe"}
                  </p>
                </div>
                <StatusChip tone="pending" icon={CalendarClock}>
                  After service
                </StatusChip>
              </div>
              <p className="type-meta mt-4 max-w-lg text-white/65">
                We&rsquo;ll guide you to a stewarded pickup zone and match you
                with a verified driver when the gathering ends.
              </p>
            </div>

            <div className="p-5 sm:p-6">
              <CardHeader
                eyebrow="Your journey home"
                title={`Where should we take you, ${firstName}?`}
                description="Choose a destination now; track, ride type and safety sharing stay editable before you confirm."
              />

              <DestinationSearch
                value={null}
                onSelect={beginRequest}
                placeholder="Search your destination"
                className="mt-5"
              />

              <div className="mt-3 flex flex-wrap gap-2" aria-label="Quick destinations">
                {[homeDestination, LOCATIONS.lifeCamp, LOCATIONS.wuseII].map(
                  (location) => (
                    <button
                      key={location.id}
                      type="button"
                      onClick={() => beginRequest(location)}
                      className="kx-tap rounded-full border border-line bg-surface-nested px-3.5 py-2 text-[0.8125rem] font-medium text-ink-secondary transition-colors hover:border-forest-400 hover:text-ink"
                    >
                      {location.id === homeDestination.id
                        ? `Home · ${location.label}`
                        : location.label}
                    </button>
                  ),
                )}
              </div>
            </div>
          </Card>

          {/* Active journey */}
          {openRide ? (
            <Card radius="xl">
              <CardHeader
                eyebrow="Active journey"
                title={`${openRide.pickup.label} → ${openRide.destination.label}`}
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
                href={`/passenger/rides/${openRide.id}`}
                variant="secondary"
                size="md"
                block
                className="mt-4"
                iconRight={ArrowRight}
              >
                View journey
              </ButtonLink>
            </Card>
          ) : null}

          {/* Recent rides */}
          <Card radius="xl">
            <CardHeader
              title="Recent journeys"
              action={
                <Link
                  href="/passenger/rides"
                  className="kx-tap type-meta inline-flex items-center font-medium text-forest-700 underline-offset-4 hover:underline dark:text-gold-300"
                >
                  View all
                </Link>
              }
            />

            <div className="mt-5 space-y-3">
              {loadingRides ? (
                <>
                  <RideCardSkeleton />
                  <RideCardSkeleton />
                </>
              ) : recentRides.length === 0 ? (
                <EmptyState
                  icon={RouteIcon}
                  size="sm"
                  title="Your journeys will appear here."
                  description="Once you've travelled, every trip is kept with its route, driver and status."
                />
              ) : (
                recentRides.map((ride) => (
                  <RideCard key={ride.id} ride={ride} href={`/passenger/rides/${ride.id}`} />
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Side column */}
        <div className="min-w-0 space-y-5">
          {/* Membership + safety */}
          <Card radius="xl">
            <CardHeader title="Your status" />

            <div className="mt-4 space-y-3">
              <NestedTile className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ShieldCheck
                    className="size-4.5 shrink-0 text-forest-600 dark:text-gold-400"
                    strokeWidth={1.7}
                    aria-hidden
                  />
                  <span className="type-body text-ink-secondary">Membership</span>
                </div>
                {passenger ? (
                  <StatusBadge
                    presentation={MEMBERSHIP_PRESENTATION[passenger.membershipStatus]}
                  />
                ) : (
                  <Skeleton className="h-6 w-24 rounded-full" />
                )}
              </NestedTile>

              <NestedTile className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Share2
                    className="size-4.5 shrink-0 text-ink-muted"
                    strokeWidth={1.7}
                    aria-hidden
                  />
                  <span className="type-body text-ink-secondary">Trip sharing</span>
                </div>
                <StatusChip tone={autoShare ? "active" : "neutral"} dot>
                  {autoShare
                    ? `On · ${selectedContactIds.length} selected`
                    : "Off"}
                </StatusChip>
              </NestedTile>

              <NestedTile className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <LifeBuoy
                    className="size-4.5 shrink-0 text-ink-muted"
                    strokeWidth={1.7}
                    aria-hidden
                  />
                  <span className="type-body text-ink-secondary">
                    Trusted contacts
                  </span>
                </div>
                <span className="type-numeric text-[0.875rem] font-semibold text-ink">
                  {passenger?.trustedContacts.length ?? 0}
                </span>
              </NestedTile>
            </div>

            <ButtonLink
              href="/passenger/safety"
              variant="secondary"
              size="sm"
              block
              className="mt-4"
            >
              Safety settings
            </ButtonLink>
          </Card>

          {/* Recent drivers */}
          <Card radius="xl">
            <CardHeader
              title="Recent drivers"
              description="People who have driven you before."
            />

            <div className="mt-4 space-y-3">
              {recentDrivers.length === 0 ? (
                <p className="type-meta text-ink-muted">
                  Drivers you travel with will be listed here.
                </p>
              ) : (
                recentDrivers.map((driver) => (
                  <div key={driver.id} className="flex items-center gap-3">
                    <Avatar
                      name={driver.fullName}
                      src={driver.avatarUrl}
                      size="sm"
                      verified
                    />
                    <div className="min-w-0 flex-1">
                      <p className="type-meta truncate font-medium text-ink">
                        {shortName(driver.fullName)}
                      </p>
                      <RatingValue value={driver.rating} />
                    </div>
                    <VerifiedBadge label="Verified" />
                  </div>
                ))
              )}
            </div>
          </Card>

          {passenger?.membershipStatus !== MembershipStatus.VERIFIED &&
          passenger ? (
            <Card radius="xl" className="border-gold-300/50 bg-gold-50/60 dark:bg-gold-500/8">
              <p className="type-card-title text-ink">Confirm your membership</p>
              <p className="type-meta mt-1.5 text-ink-secondary">
                {MEMBERSHIP_PRESENTATION[passenger.membershipStatus].detail}
              </p>
              <ButtonLink
                href="/verify-member"
                variant="primary"
                size="sm"
                block
                className="mt-4"
              >
                Continue
              </ButtonLink>
            </Card>
          ) : null}

          <DataPoint
            className="px-1"
            label="A note on safety"
            value={
              <span className="type-meta font-normal text-ink-muted">
                Verification and live tracking reduce risk. They don&rsquo;t
                guarantee a safe journey, and the network doesn&rsquo;t provide
                insurance for rides.
              </span>
            }
          />
        </div>
      </div>
    </div>
  );
}
