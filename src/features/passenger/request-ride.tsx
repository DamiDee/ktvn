"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, HandHeart, Search, User, Users, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SafetyNote } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/app-shell";
import { DestinationSearch } from "@/components/rides/destination-search";
import { FarePanel } from "@/components/payments/fare-panel";
import { MapCanvas } from "@/components/maps/map-canvas";
import { queryKeys } from "@/constants/query-keys";
import { rideService } from "@/services";
import { LOCATIONS } from "@/mocks/locations";
import { useRideStore } from "@/stores/ride-store";
import { DriverTrack, RideStatus, RideType } from "@/types/enums";
import { TRACK_DESCRIPTION } from "@/constants/status-presentation";

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
  const setTrack = useRideStore((state) => state.setTrack);
  const setRideType = useRideStore((state) => state.setRideType);
  const setPickup = useRideStore((state) => state.setPickup);
  const setDestination = useRideStore((state) => state.setDestination);
  const setEstimate = useRideStore((state) => state.setEstimate);
  const transition = useRideStore((state) => state.transition);
  const reset = useRideStore((state) => state.reset);

  // Pickup defaults to the member's current location.
  useEffect(() => {
    if (!pickup) setPickup(LOCATIONS.koinoniaCentre);
  }, [pickup, setPickup]);

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
        title="Where are you heading?"
        description="Choose how you'd like to travel. Both tracks use the same verified drivers and the same live tracking."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Controls */}
        <div className="min-w-0">
          <Card radius="xl">
            <div className="space-y-6">
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

              {/* Destination */}
              <div>
                <p className="type-micro mb-2.5 text-ink-muted">
                  Where are you going?
                </p>
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
                        setPickup(LOCATIONS.koinoniaCentre);
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
