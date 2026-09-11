"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Accessibility,
  ArrowRight,
  CalendarClock,
  Check,
  Clock3,
  Footprints,
  HandHeart,
  Search,
  ShieldCheck,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { Card, NestedTile } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Toggle } from "@/components/ui/toggle";
import { Checkbox } from "@/components/ui/input";
import { SafetyNote } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/app-shell";
import { DestinationSearch } from "@/components/rides/destination-search";
import { FarePanel } from "@/components/payments/fare-panel";
import { MapCanvas } from "@/components/maps/map-canvas";
import { queryKeys } from "@/constants/query-keys";
import { rideService } from "@/services";
import { CURRENT_PASSENGER } from "@/mocks/people";
import { DEFAULT_PICKUP_ZONE, PICKUP_ZONES } from "@/mocks/pickup-zones";
import { useRideStore } from "@/stores/ride-store";
import { useSafetyStore } from "@/stores/safety-store";
import { DriverTrack, RideStatus, RideType } from "@/types/enums";
import { TRACK_DESCRIPTION } from "@/constants/status-presentation";
import { cn } from "@/lib/cn";
import { formatDate, formatTime } from "@/lib/format";

/**
 * The ride request screen.
 *
 * Track and type live in the ride store, so the choice survives navigation
 * into matching and back. The estimate is fetched only once both ends of the
 * journey are known.
 */
export function RequestRide() {
  const router = useRouter();

  const track = useRideStore((state) => state.track);
  const rideType = useRideStore((state) => state.rideType);
  const pickup = useRideStore((state) => state.pickup);
  const destination = useRideStore((state) => state.destination);
  const pickupZone = useRideStore((state) => state.pickupZone);
  const departurePlan = useRideStore((state) => state.departurePlan);
  const setTrack = useRideStore((state) => state.setTrack);
  const setRideType = useRideStore((state) => state.setRideType);
  const setDestination = useRideStore((state) => state.setDestination);
  const setPickupZone = useRideStore((state) => state.setPickupZone);
  const setDeparturePlan = useRideStore((state) => state.setDeparturePlan);
  const setEstimate = useRideStore((state) => state.setEstimate);
  const transition = useRideStore((state) => state.transition);
  const reset = useRideStore((state) => state.reset);

  const autoShare = useSafetyStore((state) => state.autoShare);
  const setAutoShare = useSafetyStore((state) => state.setAutoShare);
  const selectedContactIds = useSafetyStore((state) => state.selectedContactIds);
  const toggleContact = useSafetyStore((state) => state.toggleContact);

  const { data: event } = useQuery({
    queryKey: queryKeys.passenger.event(),
    queryFn: () => rideService.getUpcomingEvent(),
  });

  // Event rides default to the clearest stewarded meeting point.
  useEffect(() => {
    if (!pickup) setPickupZone(DEFAULT_PICKUP_ZONE);
  }, [pickup, setPickupZone]);

  const canEstimate = Boolean(pickup && destination);

  const { data: estimate, isFetching } = useQuery({
    queryKey: canEstimate
      ? queryKeys.estimate(pickup!.id, destination!.id, track, rideType)
      : ["estimate", "idle"],
    queryFn: () =>
      rideService.estimate(pickup!, destination!, track, rideType),
    enabled: canEstimate,
  });

  // Mirror the estimate into the store so matching can pick it up.
  useEffect(() => {
    if (estimate) setEstimate(estimate.route, estimate.fare ?? null);
  }, [estimate, setEstimate]);

  function findRide() {
    if (!canEstimate) return;
    // IDLE → REQUESTING is the only legal first move; the store enforces it.
    if (transition(RideStatus.REQUESTING)) {
      router.push("/passenger/matching");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Request a ride"
        title="Plan your journey home."
        description="Choose when you’re leaving, meet your driver at a clear pickup zone, and keep someone you trust in the loop."
      />

      {event ? (
        <Card
          radius="xl"
          elevation="dark"
          className="mb-5 overflow-hidden border-white/8"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-gold-500 text-forest-950">
                <CalendarClock className="size-5" strokeWidth={1.8} aria-hidden />
              </span>
              <div>
                <p className="type-micro text-white/45">Your next gathering</p>
                <p className="type-card-title mt-1 text-white">{event.name}</p>
                <p className="type-meta mt-0.5 text-white/60">
                  {formatDate(event.startsAt)} · ends {formatTime(event.endsAt)}
                </p>
              </div>
            </div>
            <p className="type-meta max-w-sm text-white/60">
              Pickup zones open as the service ends, with stewards helping
              members find the right car.
            </p>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Controls */}
        <div className="min-w-0">
          <Card radius="xl">
            <div className="space-y-6">
              {/* Departure */}
              <div>
                <p className="type-micro mb-2.5 text-ink-muted">Leaving</p>
                <SegmentedControl
                  label="Departure time"
                  value={departurePlan}
                  onChange={setDeparturePlan}
                  options={[
                    {
                      value: "AFTER_EVENT",
                      label: "After service",
                      icon: CalendarClock,
                    },
                    { value: "NOW", label: "Leave now", icon: Clock3 },
                  ]}
                />
                <p className="type-meta mt-2.5 text-ink-secondary">
                  {departurePlan === "AFTER_EVENT" && event
                    ? `We’ll look for a driver around ${formatTime(event.endsAt)}.`
                    : "We’ll start looking as soon as you confirm."}
                </p>
              </div>

              {/* Track */}
              <div>
                <p className="type-micro mb-2.5 text-ink-muted">Track</p>
                <SegmentedControl
                  label="Transportation track"
                  size="lg"
                  value={track}
                  onChange={setTrack}
                  options={[
                    {
                      value: DriverTrack.VOLUNTEER,
                      label: "Volunteer",
                      icon: HandHeart,
                    },
                    {
                      value: DriverTrack.PROFESSIONAL,
                      label: "Professional",
                      icon: Wallet,
                    },
                  ]}
                />
                <p className="type-meta mt-2.5 text-ink-secondary">
                  {TRACK_DESCRIPTION[track]}
                </p>
              </div>

              {/* Ride type */}
              <div>
                <p className="type-micro mb-2.5 text-ink-muted">Ride type</p>
                <SegmentedControl
                  label="Ride type"
                  value={rideType}
                  onChange={setRideType}
                  options={[
                    { value: RideType.PRIVATE, label: "Private", icon: User },
                    { value: RideType.SHARED, label: "Shared", icon: Users },
                  ]}
                />
                <p className="type-meta mt-2.5 text-ink-secondary">
                  {rideType === RideType.SHARED
                    ? "Travel with up to two other members heading the same way."
                    : "Just you, or the people travelling with you."}
                </p>
              </div>

              {/* Pickup zone */}
              <div>
                <div className="mb-2.5 flex items-end justify-between gap-3">
                  <div>
                    <p className="type-micro text-ink-muted">Pickup zone</p>
                    <p className="type-meta mt-1 text-ink-secondary">
                      Choose the sign you&rsquo;ll walk to after service.
                    </p>
                  </div>
                  <span className="type-meta shrink-0 text-ink-muted">
                    Stewarded
                  </span>
                </div>

                <div
                  role="radiogroup"
                  aria-label="Pickup zone"
                  className="space-y-2.5"
                >
                  {PICKUP_ZONES.map((zone) => {
                    const selected = pickupZone?.id === zone.id;
                    return (
                      <button
                        key={zone.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPickupZone(zone)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-[var(--kx-radius-md)] border p-3.5 text-left transition-[border-color,background-color,box-shadow]",
                          selected
                            ? "border-gold-500 bg-gold-50/70 shadow-sm dark:bg-gold-500/10"
                            : "border-line bg-surface-nested hover:border-line-strong",
                        )}
                      >
                        <span
                          className={cn(
                            "type-numeric inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[0.875rem] font-bold",
                            selected
                              ? "bg-gold-500 text-forest-950"
                              : "bg-surface text-ink-secondary ring-1 ring-line",
                          )}
                        >
                          {zone.code}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="type-body font-medium text-ink">
                              {zone.label}
                            </span>
                            {zone.recommended ? (
                              <span className="rounded-full bg-forest-100 px-2 py-0.5 text-[0.6875rem] font-medium text-forest-800 dark:bg-forest-500/15 dark:text-forest-100">
                                Recommended
                              </span>
                            ) : null}
                          </span>
                          <span className="type-meta mt-0.5 block text-ink-muted">
                            {zone.landmark}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1 text-ink-muted">
                          <span className="type-meta inline-flex items-center gap-1">
                            <Footprints className="size-3.5" aria-hidden />
                            {zone.walkingMinutes} min
                          </span>
                          {zone.accessible ? (
                            <Accessibility
                              className="size-3.5"
                              aria-label="Accessible pickup"
                            />
                          ) : null}
                        </span>
                        {selected ? (
                          <Check
                            className="size-4 shrink-0 text-forest-700 dark:text-gold-400"
                            aria-hidden
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Destination */}
              <div>
                <p className="type-micro mb-2.5 text-ink-muted">Destination</p>
                <DestinationSearch
                  value={destination}
                  onSelect={setDestination}
                  onClear={() => {
                    setDestination(null);
                    setEstimate(null, null);
                  }}
                />
              </div>

              {/* Fare — absent entirely on the volunteer track */}
              <FarePanel
                track={track}
                rideType={rideType}
                fare={estimate?.fare ?? null}
                loading={isFetching}
              />

              {/* Safety circle */}
              <NestedTile className="space-y-3.5">
                <Toggle
                  checked={autoShare}
                  onChange={setAutoShare}
                  label="Share this trip automatically"
                  description="A trusted contact gets the live link when your driver starts moving."
                  size="sm"
                />

                {autoShare ? (
                  <div className="border-t border-line pt-3">
                    <p className="type-micro mb-2.5 flex items-center gap-1.5 text-ink-muted">
                      <ShieldCheck className="size-3.5" aria-hidden />
                      Your safety circle
                    </p>
                    <div className="space-y-2">
                      {CURRENT_PASSENGER.trustedContacts.map((contact) => (
                        <Checkbox
                          key={contact.id}
                          checked={selectedContactIds.includes(contact.id)}
                          onChange={() => toggleContact(contact.id)}
                          label={
                            <span>
                              <span className="font-medium text-ink">
                                {contact.name}
                              </span>
                              {contact.relationship
                                ? ` · ${contact.relationship}`
                                : ""}
                            </span>
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </NestedTile>

              <div className="space-y-3">
                <Button
                  variant="primary"
                  size="xl"
                  block
                  pill
                  icon={Search}
                  iconRight={ArrowRight}
                  disabled={!canEstimate}
                  onClick={findRide}
                >
                  Find a Ride
                </Button>

                {!destination ? (
                  <p className="type-meta text-center text-ink-muted">
                    Choose a destination to continue.
                  </p>
                ) : null}
              </div>

              <SafetyNote>
                Your driver, their vehicle and its plate are shown before you
                board, and the journey stays on a live map. Verification
                reduces risk; it doesn&rsquo;t guarantee a safe journey.
              </SafetyNote>
            </div>
          </Card>
        </div>

        {/* Preview map */}
        <div className="min-w-0">
          <Card radius="xl" padded={false} className="overflow-hidden">
            <MapCanvas
              className="h-[320px] w-full lg:h-[560px]"
              loading={!pickup}
              loadingMessage="Locating you…"
              description={
                destination && pickup
                  ? `Route preview from ${pickup.label} to ${destination.label}.`
                  : "Map showing your current location. Choose a destination to preview the route."
              }
              routes={
                estimate?.route
                  ? [
                      {
                        id: "preview",
                        path: estimate.route,
                        variant: "primary",
                        animateDraw: true,
                      },
                    ]
                  : []
              }
              markers={[
                ...(pickup
                  ? [
                      {
                        id: "pickup",
                        position: pickup,
                        kind: "passenger" as const,
                        pulse: true,
                      },
                    ]
                  : []),
                ...(destination
                  ? [
                      {
                        id: "destination",
                        position: destination,
                        kind: "destination" as const,
                      },
                    ]
                  : []),
              ]}
            >
              {estimate?.route ? (
                <div className="absolute inset-x-4 bottom-4 z-20">
                  <div className="surface-glass flex items-center justify-between gap-4 rounded-[var(--kx-radius-lg)] px-4 py-3">
                    <div>
                      <p className="type-micro text-ink-muted">Distance</p>
                      <p className="type-numeric text-[0.9375rem] font-semibold text-ink">
                        {estimate.route.distanceKm.toFixed(1)} km
                      </p>
                    </div>
                    <div className="h-8 w-px bg-line-strong" aria-hidden />
                    <div>
                      <p className="type-micro text-ink-muted">Journey time</p>
                      <p className="type-numeric text-[0.9375rem] font-semibold text-ink">
                        ~{estimate.route.durationMinutes} min
                      </p>
                    </div>
                    <div className="h-8 w-px bg-line-strong" aria-hidden />
                    <button
                      type="button"
                      onClick={() => {
                        reset();
                        setPickupZone(DEFAULT_PICKUP_ZONE);
                      }}
                      className="type-meta font-medium text-forest-700 underline-offset-4 hover:underline dark:text-gold-300"
                    >
                      Start over
                    </button>
                  </div>
                </div>
              ) : null}
            </MapCanvas>
          </Card>
        </div>
      </div>
    </div>
  );
}
