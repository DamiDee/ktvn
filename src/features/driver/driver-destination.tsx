"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MapPin, Radar, Users } from "lucide-react";
import { Card, NestedTile } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusChip } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/app-shell";
import { DestinationSearch } from "@/components/rides/destination-search";
import { MapCanvas } from "@/components/maps/map-canvas";
import { useCurrentDriver } from "./use-current-driver";
import { LOCATIONS } from "@/mocks/locations";
import { buildRoute } from "@/lib/geo";
import { formatDistanceKm, formatMinutes } from "@/lib/format";
import { MAX_SHARED_PASSENGERS } from "@/types/enums";
import type { RideLocation } from "@/types/models";

type Seats = "1" | "2" | "3";

/**
 * Set the destination the driver is already heading to.
 *
 * Matching works along this route, so drawing it is the point of the screen —
 * the driver should see exactly which corridor they're offering.
 */
export function DriverDestination() {
  const router = useRouter();
  const { toast } = useToast();

  const { data: driver } = useCurrentDriver();

  const pickup = LOCATIONS.koinoniaCentre;
  const [destination, setDestination] = useState<RideLocation | null>(null);
  const [seats, setSeats] = useState<Seats>("3");

  const route = useMemo(
    () =>
      destination
        ? buildRoute(pickup, destination, {
            seed: `driver-${destination.id}`,
          })
        : undefined,
    [pickup, destination],
  );

  function startAccepting() {
    if (!destination) return;
    toast({
      title: "You're accepting requests",
      description: `Members heading toward ${destination.label} can now find you.`,
      tone: "success",
    });
    router.push("/driver/requests");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Availability"
        title="Where are you heading?"
        description="Requests are matched to members travelling along your route, so you go where you were already going."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Controls */}
        <div className="min-w-0">
          <Card radius="xl">
            <div className="space-y-6">
              <div>
                <p className="type-micro mb-2.5 text-ink-muted">
                  Starting from
                </p>
                <NestedTile className="flex items-center gap-3">
                  <span className="relative flex size-2.5 shrink-0">
                    <span
                      className="absolute inline-flex size-full rounded-full bg-forest-500/60"
                      style={{ animation: "kx-pulse-ring 2.4s ease-out infinite" }}
                      aria-hidden
                    />
                    <span className="relative inline-flex size-2.5 rounded-full bg-forest-700 dark:bg-gold-400" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="type-body truncate font-medium text-ink">
                      {pickup.label}
                    </p>
                    <p className="type-meta truncate text-ink-muted">
                      Current location
                    </p>
                  </div>
                </NestedTile>
              </div>

              <div>
                <p className="type-micro mb-2.5 text-ink-muted">Destination</p>
                <DestinationSearch
                  value={destination}
                  onSelect={setDestination}
                  onClear={() => setDestination(null)}
                  placeholder="Where are you going?"
                />
              </div>

              <div>
                <p className="type-micro mb-2.5 text-ink-muted">
                  Seats available
                </p>
                <SegmentedControl
                  label="Seats available"
                  value={seats}
                  onChange={setSeats}
                  options={[
                    { value: "1", label: "1" },
                    { value: "2", label: "2" },
                    { value: "3", label: "3" },
                  ]}
                />
                <p className="type-meta mt-2.5 text-ink-secondary">
                  A shared ride carries at most {MAX_SHARED_PASSENGERS}{" "}
                  passengers.
                </p>
              </div>

              {route ? (
                <NestedTile className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="type-micro text-ink-muted">Your route</p>
                    <p className="type-numeric mt-1 text-[0.9375rem] font-semibold text-ink">
                      {formatDistanceKm(route.distanceKm)}
                    </p>
                  </div>
                  <div>
                    <p className="type-micro text-ink-muted">Journey time</p>
                    <p className="type-numeric mt-1 text-[0.9375rem] font-semibold text-ink">
                      {formatMinutes(route.durationMinutes)}
                    </p>
                  </div>
                </NestedTile>
              ) : null}

              <div className="space-y-3">
                <Button
                  variant="primary"
                  size="xl"
                  block
                  pill
                  icon={Radar}
                  iconRight={ArrowRight}
                  disabled={!destination}
                  onClick={startAccepting}
                >
                  Start Accepting Requests
                </Button>

                {!destination ? (
                  <p className="type-meta text-center text-ink-muted">
                    Choose where you&rsquo;re heading to continue.
                  </p>
                ) : null}
              </div>
            </div>
          </Card>
        </div>

        {/* Map */}
        <div className="min-w-0">
          <Card radius="xl" padded={false} className="overflow-hidden">
            <MapCanvas
              className="h-[340px] w-full lg:h-[600px]"
              description={
                destination
                  ? `Your route from ${pickup.label} to ${destination.label}.`
                  : "Map showing your current location. Choose a destination to draw your route."
              }
              routes={
                route
                  ? [
                      {
                        id: "driver-route",
                        path: route,
                        variant: "primary",
                        animateDraw: true,
                      },
                    ]
                  : []
              }
              markers={[
                { id: "origin", position: pickup, kind: "pickup", pulse: true },
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
              {destination ? (
                <div className="absolute inset-x-4 bottom-4 z-20">
                  <div className="surface-glass flex items-center gap-3 rounded-[var(--kx-radius-lg)] px-4 py-3">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-gold-700 dark:text-gold-300">
                      <MapPin className="size-4" strokeWidth={1.9} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="type-micro text-ink-muted">Heading to</p>
                      <p className="type-body truncate font-medium text-ink">
                        {destination.label}
                      </p>
                    </div>
                    <StatusChip tone="neutral" icon={Users}>
                      {seats} {Number(seats) === 1 ? "seat" : "seats"}
                    </StatusChip>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-x-4 bottom-4 z-20">
                  <div className="surface-glass rounded-[var(--kx-radius-lg)] px-4 py-3">
                    <p className="type-meta text-ink-secondary">
                      Waiting for passengers heading your direction — set a
                      destination to begin.
                    </p>
                  </div>
                </div>
              )}
            </MapCanvas>
          </Card>

          {driver ? (
            <p className="type-meta mt-3 text-center text-ink-muted">
              Passengers will see your {driver.vehicle.colour.toLowerCase()}{" "}
              {driver.vehicle.make} {driver.vehicle.model} and plate{" "}
              <span className="type-numeric">{driver.vehicle.plateNumber}</span>{" "}
              before they board.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
