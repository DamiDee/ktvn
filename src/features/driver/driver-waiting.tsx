"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Inbox, MapPin, Radar, Users } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/badge";
import { Divider, NestedTile } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/route-loader";
import { MapCanvas } from "@/components/maps/map-canvas";
import { RideSheet, useRideSheetInset } from "@/components/rides/ride-sheet";
import { SeatMap } from "@/components/rides/seat-map";
import { useCurrentDriver } from "./use-current-driver";
import { queryKeys } from "@/constants/query-keys";
import { rideService } from "@/services";
import { LOCATIONS } from "@/mocks/locations";
import {
  DRIVER_AVAILABILITY_PRESENTATION,
  TRACK_LABEL,
  TRACK_TONE,
} from "@/constants/status-presentation";
import { DriverTrack, MAX_SHARED_PASSENGERS } from "@/types/enums";
import { isDriverOnline } from "@/lib/state-machines";
import { buildRoute } from "@/lib/geo";
import { pluralise } from "@/lib/format";
import { useSessionStore } from "@/stores/session-store";

/**
 * Waiting for a match.
 *
 * The driver is online, the route they are already taking is on the map, and
 * the radar says the network is looking. Nothing here asks them to do
 * anything — it exists so the wait is legible rather than blank.
 */
export function DriverWaiting() {
  const router = useRouter();
  const mapInset = useRideSheetInset();

  const { data: driver, isLoading } = useCurrentDriver();
  const selectedTrack = useSessionStore((state) => state.driverTrack);
  const sessionOnline = useSessionStore((state) => state.driverOnline);
  const activeTrack = driver?.eligibleTracks?.includes(selectedTrack)
    ? selectedTrack
    : driver?.track;

  const { data: requests } = useQuery({
    queryKey: queryKeys.driver.requests(activeTrack ?? "none"),
    queryFn: () => rideService.listRequests(activeTrack!),
    enabled: Boolean(activeTrack),
  });

  if (isLoading || !driver) {
    return <PageLoader message="Checking your availability" />;
  }

  const online = sessionOnline || isDriverOnline(driver.availability);
  const availability = DRIVER_AVAILABILITY_PRESENTATION[driver.availability];
  const volunteer = activeTrack === DriverTrack.VOLUNTEER;

  // The driver's own journey: where they are, and where they are going anyway.
  const origin = driver.currentLocation ?? LOCATIONS.koinoniaCentre;
  const destination = LOCATIONS.gwarinpa;
  const route = buildRoute(origin, destination, { seed: driver.id });

  const waiting = requests?.length ?? 0;
  const freeSeats = MAX_SHARED_PASSENGERS;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapCanvas
        className="absolute inset-0 size-full"
        description={`Map showing your route to ${destination.label} while the network looks for members heading your way.`}
        routes={[{ id: "route", path: route, variant: "primary" }]}
        markers={[
          { id: "you", position: origin, kind: "vehicle", track: activeTrack },
          { id: "destination", position: destination, kind: "destination" },
        ]}
        viewport={{ focus: [origin, destination], ...mapInset }}
        searching={online}
      >
        <div className="absolute top-4 left-4 z-20">
          <span className="surface-glass inline-flex items-center gap-2 rounded-full px-3 py-2">
            <span className="relative flex size-2">
              {online ? (
                <span
                  className="absolute inline-flex size-full rounded-full bg-success-500"
                  style={{ animation: "kx-pulse-ring 2.4s ease-out infinite" }}
                  aria-hidden
                />
              ) : null}
              <span
                className={cnDot(online)}
                aria-hidden
              />
            </span>
            <span className="type-micro text-ink">
              {online ? "Looking for members" : "You're offline"}
            </span>
          </span>
        </div>
      </MapCanvas>

      <RideSheet
        label="Availability"
        allowed={["collapsed", "medium", "expanded"]}
        detent="medium"
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={TRACK_TONE[activeTrack ?? driver.track]}>
            {TRACK_LABEL[activeTrack ?? driver.track]}
          </StatusChip>
          <StatusChip
            tone={availability.tone === "active" ? "active" : "neutral"}
            dot
            live={online}
          >
            {availability.label}
          </StatusChip>
        </div>

        <h1 className="type-section-title mt-3 text-ink">
          {online
            ? "Waiting for members heading your way."
            : "You're offline right now."}
        </h1>
        <p className="type-body mt-1.5 text-ink-secondary">
          {online
            ? "We'll only offer you journeys that fit the route you're already taking."
            : "Go online from your dashboard to start receiving requests."}
        </p>

        <Divider />

        <div className="grid gap-3 sm:grid-cols-2">
          <NestedTile>
            <div className="flex items-center gap-2">
              <MapPin
                className="size-4 text-ink-muted"
                strokeWidth={1.7}
                aria-hidden
              />
              <p className="type-micro text-ink-muted">Your destination</p>
            </div>
            <p className="type-body mt-1.5 truncate font-medium text-ink">
              {destination.label}
            </p>
          </NestedTile>

          <NestedTile>
            <div className="flex items-center gap-2">
              <Users
                className="size-4 text-ink-muted"
                strokeWidth={1.7}
                aria-hidden
              />
              <p className="type-micro text-ink-muted">Free seats</p>
            </div>
            <p className="type-body mt-1.5 font-medium text-ink">
              {freeSeats} of {MAX_SHARED_PASSENGERS}
            </p>
          </NestedTile>
        </div>

        <div className="mt-4">
          <p className="type-micro mb-2.5 text-ink-muted">Your car</p>
          <SeatMap occupants={[]} showSummary />
        </div>

        {volunteer ? (
          <p className="type-meta mt-4 text-ink-muted">
            Journeys you give are service. No fare is shown to you or to the
            members you carry.
          </p>
        ) : null}

        <div className="sticky bottom-0 -mx-5 mt-6 border-t border-line bg-surface/95 px-5 py-4 backdrop-blur-xl">
          {waiting > 0 ? (
            <ButtonLink
              href="/driver/requests"
              variant="primary"
              size="lg"
              block
              icon={Inbox}
            >
              {waiting} {pluralise(waiting, "request")} waiting
            </ButtonLink>
          ) : (
            <Button
              variant="secondary"
              size="lg"
              block
              icon={Radar}
              onClick={() => router.push("/driver/destination")}
            >
              Change your destination
            </Button>
          )}
        </div>
      </RideSheet>
    </div>
  );
}

/** The steady dot under the radar ping. */
function cnDot(online: boolean) {
  return online
    ? "relative inline-flex size-2 rounded-full bg-success-500"
    : "relative inline-flex size-2 rounded-full bg-neutral-400";
}
