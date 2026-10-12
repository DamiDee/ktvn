"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crosshair } from "lucide-react";
import { useIsDesktop } from "@/hooks/use-media-query";
import { PAID_RIDES_CONFIG } from "../config";
import { deriveDriverPhase, type DriverPhase } from "../domain/phases";
import { useLocationStore } from "../location/location-store";
import { useDriverLocationReporter } from "../location/use-location";
import { useWakeLock } from "../hooks/use-wake-lock";
import { useDriverStore } from "../state/driver-store";
import { useHideRideNav, useRideShell } from "../shell/ride-module-shell";
import { getRideService } from "../services";
import { RideMap } from "../components/ride-map";
import { RideSheet } from "../components/ride-sheet";
import { DriverCardSkeleton } from "../components/ride-ui";
import { ConnectionPill, LiveAnnouncer, MapControlButton } from "../components/status-overlays";
import type { CameraIntent, MapInsets, MapVehicle } from "../maps/leaflet-ride-map";
import { AvailabilityPanel, DriverSummaryPanel, DriverTripPanel, PickupPanel } from "./driver-panels";
import { RequestSheet } from "./request-sheet";

/**
 * The driver's single operational surface: availability, incoming requests,
 * pickup, trip and summary over one persistent map. Location is watched and
 * reported only while the driver is online or on a trip.
 */

const ANNOUNCEMENTS: Partial<Record<DriverPhase, string>> = {
  ONLINE_WAITING: "You're online and waiting for requests.",
  OFFLINE: "You're offline.",
  REQUEST_INCOMING: "New ride request.",
  REQUEST_UNAVAILABLE: "That request is no longer available.",
  EN_ROUTE_TO_PICKUP: "Ride accepted. Head to the pickup.",
  ARRIVED_AT_PICKUP: "Arrival confirmed. Waiting for the rider.",
  TRIP_ACTIVE: "Trip started.",
  TRIP_COMPLETED: "Trip complete.",
  RIDE_CANCELLED: "The trip was cancelled.",
};

export function DriverRideScreen() {
  const state = useDriverStore((store) => store.state);
  const fix = useLocationStore((store) => store.fix);
  const { navInset } = useRideShell();
  const desktop = useIsDesktop();
  const phase = deriveDriverPhase(state);
  const ride = state.ride.ride;
  const offer = state.offer;
  const [cover, setCover] = useState({ bottom: 0, left: 0 });
  const [exploring, setExploring] = useState(false);
  const [recenterToken, setRecenterToken] = useState(0);
  const viewer = useQuery({ queryKey: ["paid-rides", "viewer"], queryFn: ({ signal }) => getRideService().getViewer(signal), staleTime: 5 * 60_000 });

  const online = state.availability === "ONLINE" || state.availability === "ON_TRIP" || state.availability === "GOING_OFFLINE";
  useDriverLocationReporter(online);
  useWakeLock(phase === "EN_ROUTE_TO_PICKUP" || phase === "ARRIVED_AT_PICKUP" || phase === "TRIP_ACTIVE");

  const onCoverChange = useCallback((next: { bottom: number; left: number }) => {
    setCover((current) => (current.bottom === next.bottom && current.left === next.left ? current : next));
  }, []);

  const insets: MapInsets = useMemo(
    () => ({ top: desktop ? 16 : 64, right: 0, bottom: desktop ? 0 : cover.bottom, left: desktop ? cover.left + 16 : 0 }),
    [desktop, cover.bottom, cover.left],
  );

  const onRide = phase === "EN_ROUTE_TO_PICKUP" || phase === "ARRIVED_AT_PICKUP" || phase === "TRIP_ACTIVE";
  const selfPoint = ride?.driverLocation?.point ?? fix?.point ?? null;
  const vehicle: MapVehicle | null = selfPoint
    ? {
        point: selfPoint,
        heading: ride?.driverLocation?.heading ?? fix?.heading ?? null,
        vehicleClass: viewer.data?.vehicle?.vehicleClass ?? "sedan",
        paint: viewer.data?.vehicle?.colorHex ?? "var(--kx-gold-400)",
      }
    : null;

  let camera: CameraIntent | null = null;
  let cameraKey: string = phase;
  if ((phase === "REQUEST_INCOMING" || phase === "REQUEST_ACCEPTING") && offer) {
    camera = { kind: "fit", points: [...(selfPoint ? [selfPoint] : []), offer.offer.pickup.point, ...(offer.offer.destination ? [offer.offer.destination.point] : [])] };
    cameraKey = `offer-${offer.offer.offerId}`;
  } else if (phase === "EN_ROUTE_TO_PICKUP" && ride && selfPoint) {
    camera = { kind: "follow", points: [selfPoint, ride.pickup.point] };
  } else if (phase === "ARRIVED_AT_PICKUP" && ride) {
    camera = { kind: "point", point: ride.pickup.point, zoom: 17 };
  } else if (phase === "TRIP_ACTIVE" && ride && selfPoint) {
    camera = { kind: "follow", points: [selfPoint, ride.destination.point] };
  } else if ((phase === "TRIP_COMPLETED" || phase === "RIDE_CANCELLED") && ride) {
    camera = { kind: "fit", points: ride.route.points };
  } else {
    camera = { kind: "point", point: selfPoint ?? PAID_RIDES_CONFIG.defaultCenter, zoom: 15 };
    cameraKey = `${phase}-${selfPoint ? "located" : "default"}`;
  }

  useHideRideNav(onRide || phase.startsWith("REQUEST") || phase === "TRIP_COMPLETED" || phase === "RIDE_CANCELLED");
  const bottomOffset = navInset;
  const sheetProps = { onCoverChange, bottomOffset };
  const showOffer = (phase === "REQUEST_INCOMING" || phase === "REQUEST_ACCEPTING" || phase === "REQUEST_UNAVAILABLE") && offer;

  return (
    <div className="absolute inset-0">
      <RideMap
        route={phase === "TRIP_ACTIVE" || phase === "TRIP_COMPLETED" ? (ride?.route ?? null) : null}
        approachRoute={phase === "EN_ROUTE_TO_PICKUP" ? (ride?.approach?.route ?? null) : null}
        pickup={showOffer ? offer.offer.pickup.point : ride && phase !== "TRIP_ACTIVE" ? ride.pickup.point : null}
        pickupLabel={showOffer ? "Pickup" : undefined}
        destination={showOffer ? (offer.offer.destination?.point ?? null) : phase === "TRIP_ACTIVE" ? ride?.destination.point : null}
        vehicle={vehicle}
        radar={phase === "ONLINE_WAITING" ? selfPoint : null}
        camera={camera}
        cameraKey={cameraKey}
        recenterToken={recenterToken}
        insets={insets}
        onUserMove={() => setExploring(true)}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center lg:left-auto lg:right-4" style={{ paddingTop: desktop ? 16 : "calc(var(--ride-safe-top) + 12px)" }}>
        <ConnectionPill status={state.ride.connection} />
      </div>

      <div className="pointer-events-none absolute right-3 z-30" style={{ bottom: (desktop ? 24 : cover.bottom) + 12 }}>
        <MapControlButton
          label="Recenter"
          icon={Crosshair}
          visible={exploring}
          onClick={() => {
            setExploring(false);
            setRecenterToken((value) => value + 1);
          }}
        />
      </div>

      {showOffer ? (
        <RequestSheet offer={offer} onCoverChange={onCoverChange} />
      ) : phase === "RESTORING" ? (
        <RideSheet label="Loading" collapsible={false} resetKey="restoring" {...sheetProps} peek={<div className="py-2"><DriverCardSkeleton /></div>} />
      ) : phase === "EN_ROUTE_TO_PICKUP" || phase === "ARRIVED_AT_PICKUP" ? (
        ride ? <PickupPanel ride={ride} arrived={phase === "ARRIVED_AT_PICKUP"} {...sheetProps} /> : null
      ) : phase === "TRIP_ACTIVE" ? (
        ride ? <DriverTripPanel ride={ride} {...sheetProps} /> : null
      ) : phase === "TRIP_COMPLETED" || phase === "RIDE_CANCELLED" ? (
        ride ? <DriverSummaryPanel ride={ride} {...sheetProps} /> : null
      ) : (
        <AvailabilityPanel
          online={phase === "ONLINE_WAITING" || phase === "GOING_OFFLINE"}
          transitioning={phase === "GOING_ONLINE" || phase === "GOING_OFFLINE"}
          {...sheetProps}
        />
      )}

      <LiveAnnouncer message={ANNOUNCEMENTS[phase] ?? ""} />
    </div>
  );
}
