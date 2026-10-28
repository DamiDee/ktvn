"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { Crosshair, PictureInPicture2, Siren } from "lucide-react";
import { useTheme } from "next-themes";
import { useIsDesktop } from "@/hooks/use-media-query";
import { trackRideEvent } from "../analytics";
import { derivePassengerPhase, phaseShowsDriver, type PassengerPhase } from "../domain/phases";
import { isOnTrip } from "../domain/ride-status";
import type { GeoPoint } from "../domain/types";
import { useLocationStore } from "../location/location-store";
import { useLocationWatch } from "../location/use-location";
import { useWakeLock } from "../hooks/use-wake-lock";
import { getMapProvider, getRideService } from "../services";
import { usePassengerStore } from "../state/passenger-store";
import { usePreferencesStore } from "../state/preferences-store";
import { useHideRideNav, useRideShell } from "../shell/ride-module-shell";
import { RideMap } from "../components/ride-map";
import { RideSheet } from "../components/ride-sheet";
import { DriverCardSkeleton } from "../components/ride-ui";
import type { CameraIntent, MapInsets, MapVehicle } from "../maps/ride-map-types";
import { ConnectionPill, LiveAnnouncer, MapControlButton } from "../components/status-overlays";
import { SosSheet } from "../safety/sos-sheet";
import { PictureInPictureHost, trackerFrameFor, usePipControls } from "../pip/floating-tracker";
import { CompletionPanel } from "./completion-panel";
import { DriverPanel } from "./driver-panel";
import { HomePanel } from "./home-panel";
import { LocationSearchPanel } from "./location-search-panel";
import { OptionsPanel } from "./options-panel";
import { CancelledPanel, NoDriversPanel } from "./outcome-panels";
import { CenterPin, PinConfirmPanel } from "./pin-confirm-panel";
import { SearchingPanel } from "./searching-panel";
import { TripPanel } from "./trip-panel";
import { useRideMoments } from "./use-ride-moments";

/**
 * The passenger's single, stateful ride surface: booking, matching, live
 * tracking and completion all happen here, over one persistent map. The
 * phase (derived from the server ride and the booking draft) picks the
 * sheet; the map follows the same phase. Nothing here decides ride state.
 */

const ANNOUNCEMENTS: Partial<Record<PassengerPhase, string>> = {
  SEARCHING_DRIVERS: "Looking for a driver.",
  NO_DRIVERS_AVAILABLE: "No drivers are available right now.",
  DRIVER_MATCHED: "Driver found and on the way.",
  DRIVER_ARRIVING: "Your driver is arriving.",
  DRIVER_ARRIVED: "Your driver has arrived.",
  TRIP_ACTIVE: "Trip in progress.",
  TRIP_COMPLETED: "Trip complete.",
  CANCELLED_BY_DRIVER: "Your driver cancelled the ride.",
  CANCELLED_BY_PASSENGER: "Ride cancelled.",
};

const TOP_OVERLAY = 64;

export function PassengerRideScreen() {
  const draft = usePassengerStore((store) => store.draft);
  const session = usePassengerStore((store) => store.session);
  const setDraft = usePassengerStore((store) => store.setDraft);
  const fix = useLocationStore((state) => state.fix);
  const { navInset } = useRideShell();
  const desktop = useIsDesktop();
  const { resolvedTheme } = useTheme();
  const ride = session.ride;
  const phase = derivePassengerPhase(draft, session);

  const [cover, setCover] = useState({ bottom: 0, left: 0 });
  const [recenterToken, setRecenterToken] = useState(0);
  const [exploring, setExploring] = useState(false);
  const [pin, setPin] = useState<{ point: GeoPoint | null; moving: boolean }>({ point: null, moving: false });
  const [sosOpen, setSosOpen] = useState(false);

  const onTrip = ride ? isOnTrip(ride.status) : false;
  // Once a ride exists the trip owns the screen; navigation steps aside.
  useHideRideNav(Boolean(ride) || phase === "REQUESTING_RIDE");

  // Location: continuous only while it changes what the rider sees.
  useLocationWatch(phase === "IDLE" || phase === "CONFIRMING_PICKUP" || phase === "DRIVER_ARRIVING" || phase === "DRIVER_ARRIVED");
  useWakeLock(phaseShowsDriver(phase));
  useRideMoments(phase, ride);

  // Pre-fill the pickup with the rider's location once, if they haven't chosen one.
  useEffect(() => {
    if (phase !== "IDLE" || draft.pickup || !fix || ride) return;
    let cancelled = false;
    void getMapProvider()
      .reverseGeocode(fix.point)
      .then((place) => {
        if (cancelled || usePassengerStore.getState().draft.pickup) return;
        setDraft({ pickup: { ...place, name: "Current location", secondary: place.name === "Pinned location" ? place.secondary : place.name, source: "current-location" } });
      });
    return () => {
      cancelled = true;
    };
  }, [phase, draft.pickup, fix, ride, setDraft]);

  // Fare estimate: server state, keyed by the two ends of the trip.
  const estimate = useQuery({
    queryKey: ["paid-rides", "estimate", draft.pickup?.id, draft.pickup?.point, draft.destination?.id, draft.destination?.point],
    queryFn: ({ signal }) => getRideService().estimateRide({ pickup: draft.pickup!, destination: draft.destination! }, signal),
    enabled: phase === "ROUTE_PREVIEW" && Boolean(draft.pickup && draft.destination),
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (phase === "SEARCHING_DRIVERS") trackRideEvent("ride_requested");
  }, [phase]);

  // ─── Map description for this phase ────────────────────────────────────

  const insets: MapInsets = useMemo(
    () => ({ top: desktop ? 16 : TOP_OVERLAY, right: 0, bottom: desktop ? 0 : cover.bottom, left: desktop ? cover.left + 16 : 0 }),
    [desktop, cover.bottom, cover.left],
  );

  const vehicle: MapVehicle | null =
    ride?.driver && ride.driverLocation && phaseShowsDriver(phase)
      ? { point: ride.driverLocation.point, heading: ride.driverLocation.heading, vehicleClass: ride.driver.vehicle.vehicleClass, paint: ride.driver.vehicle.colorHex }
      : null;

  const pickupPoint = ride?.pickup.point ?? draft.pickup?.point ?? null;
  const destinationPoint = ride?.destination.point ?? (phase === "ROUTE_PREVIEW" ? draft.destination?.point : null) ?? null;
  const route = ride && !phaseShowsDriver(phase) ? ride.route : onTrip ? ride?.route : phase === "ROUTE_PREVIEW" ? estimate.data?.route : null;
  const approachRoute = ride && phaseShowsDriver(phase) && !onTrip && phase !== "DRIVER_ARRIVED" ? ride.approach?.route : null;

  let camera: CameraIntent | null = null;
  let cameraKey: string = phase;
  if (phase === "CONFIRMING_PICKUP") {
    camera = { kind: "point", point: draft[draft.field]?.point ?? fix?.point ?? pickupPoint ?? { lat: 9.0579, lng: 7.4951 }, zoom: 17 };
    cameraKey = `pin-${draft.field}`;
  } else if (phase === "ROUTE_PREVIEW" && estimate.data) {
    camera = { kind: "fit", points: estimate.data.route.points };
    cameraKey = `route-${estimate.data.estimateId}`;
  } else if (phase === "SEARCHING_DRIVERS" || phase === "REQUESTING_RIDE" || phase === "NO_DRIVERS_AVAILABLE") {
    camera = pickupPoint ? { kind: "point", point: pickupPoint, zoom: 15 } : null;
  } else if (vehicle && onTrip && ride) {
    camera = { kind: "follow", points: [vehicle.point, ride.destination.point] };
  } else if (vehicle && ride) {
    camera = { kind: "follow", points: [vehicle.point, ride.pickup.point] };
  } else if (ride && (phase === "TRIP_COMPLETED" || phase.startsWith("CANCELLED") || phase === "PAYMENT_FAILED")) {
    camera = { kind: "fit", points: ride.route.points };
  } else {
    const home = draft.pickup?.point ?? fix?.point ?? null;
    camera = home ? { kind: "point", point: home, zoom: 15 } : null;
    cameraKey = `home-${home ? "located" : "default"}`;
  }

  const onCoverChange = useCallback((next: { bottom: number; left: number }) => {
    setCover((current) => (current.bottom === next.bottom && current.left === next.left ? current : next));
  }, [setCover]);

  const onCenterChange = useCallback((point: GeoPoint, settled: boolean) => {
    setPin((current) => (settled || !current.moving ? { point, moving: !settled } : current));
  }, [setPin]);

  const sheetProps = { onCoverChange, bottomOffset: navInset };
  const trackerFrame = ride ? trackerFrameFor(ride, phase, resolvedTheme === "dark") : null;
  const showUser = phase !== "TRIP_ACTIVE" && phase !== "TRIP_PAUSED" && phase !== "CONFIRMING_PICKUP";

  return (
    <PictureInPictureHost frame={trackerFrame}>
      <div id="main" role="main" tabIndex={-1} aria-label="Book and follow your ride" className="absolute inset-0">
        <RideMap
          route={route ?? null}
          approachRoute={approachRoute ?? null}
          approaching={Boolean(ride && phaseShowsDriver(phase) && !onTrip && phase !== "DRIVER_ARRIVED")}
          pickup={phase === "CONFIRMING_PICKUP" ? null : pickupPoint}
          pickupLabel={phase === "ROUTE_PREVIEW" ? draft.pickup?.name : undefined}
          destination={phase === "CONFIRMING_PICKUP" ? null : destinationPoint}
          destinationLabel={phase === "ROUTE_PREVIEW" ? draft.destination?.name : undefined}
          user={showUser ? (fix?.point ?? null) : null}
          vehicle={vehicle}
          radar={phase === "SEARCHING_DRIVERS" || phase === "REQUESTING_RIDE" ? pickupPoint : null}
          camera={camera}
          cameraKey={cameraKey}
          recenterToken={recenterToken}
          insets={insets}
          onCenterChange={phase === "CONFIRMING_PICKUP" ? onCenterChange : undefined}
          onUserMove={() => setExploring(true)}
        />

        {phase === "CONFIRMING_PICKUP" ? <CenterPin lifted={pin.moving} insets={insets} /> : null}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center lg:left-auto lg:right-4" style={{ paddingTop: desktop ? 16 : "calc(var(--ride-safe-top) + 12px)" }}>
          <ConnectionPill status={session.connection} />
        </div>

        {onTrip && ride ? (
          <button
            type="button"
            onClick={() => setSosOpen(true)}
            aria-label="SOS — emergency help"
            className="ride-press absolute left-3 z-30 flex h-12 items-center gap-2 rounded-full bg-[var(--ride-sos)] px-4 font-semibold text-white shadow-[var(--ride-elev-5)] lg:left-auto lg:right-4"
            style={{ top: desktop ? 96 : "calc(var(--ride-safe-top) + 12px)" }}
          >
            <Siren className="size-5" aria-hidden />
            SOS
          </button>
        ) : null}

        <div className="pointer-events-none absolute right-3 z-30 flex flex-col items-end gap-2" style={{ bottom: (desktop ? 24 : cover.bottom) + 12 }}>
          {phaseShowsDriver(phase) ? <PopOutControl /> : null}
          <MapControlButton
            label="Recenter"
            icon={Crosshair}
            visible={exploring && phase !== "CONFIRMING_PICKUP"}
            onClick={() => {
              setExploring(false);
              setRecenterToken((value) => value + 1);
            }}
          />
        </div>

        <AnimatePresence mode="popLayout">
          {phase === "SELECTING_DESTINATION" || phase === "SELECTING_PICKUP" ? <LocationSearchPanel key="search" /> : null}
        </AnimatePresence>

        <PhaseSheet phase={phase} estimate={estimate} pin={pin} sheetProps={sheetProps} />

        {ride && onTrip ? <SosSheet ride={ride} open={sosOpen} onClose={() => setSosOpen(false)} acknowledged={session.sosAcknowledged} /> : null}
        <LiveAnnouncer message={ANNOUNCEMENTS[phase] ?? ""} />
      </div>
    </PictureInPictureHost>
  );
}

/** Floats the trip again once the prompt has been dismissed. */
function PopOutControl() {
  const pip = usePipControls();
  const promptDismissed = usePreferencesStore((state) => state.pipPromptDismissed);
  // While the prompt card is showing, it already offers this.
  if (!pip || !promptDismissed || pip.strategy === "none" || pip.mode) return null;
  return <MapControlButton label="Float trip" icon={PictureInPicture2} onClick={() => void pip.enable()} />;
}

function PhaseSheet({
  phase,
  estimate,
  pin,
  sheetProps,
}: {
  phase: PassengerPhase;
  estimate: Parameters<typeof OptionsPanel>[0]["estimate"];
  pin: { point: GeoPoint | null; moving: boolean };
  sheetProps: { onCoverChange: (cover: { bottom: number; left: number }) => void; bottomOffset: number };
}) {
  const ride = usePassengerStore((store) => store.session.ride);

  switch (phase) {
    case "RESTORING":
      return <RestoringSheet {...sheetProps} />;
    case "IDLE":
    case "SELECTING_DESTINATION":
    case "SELECTING_PICKUP":
      return <HomePanel {...sheetProps} />;
    case "CONFIRMING_PICKUP":
      return <PinConfirmPanel point={pin.point} moving={pin.moving} {...sheetProps} />;
    case "ROUTE_PREVIEW":
      return <OptionsPanel estimate={estimate} {...sheetProps} />;
    case "REQUESTING_RIDE":
    case "SEARCHING_DRIVERS":
      return <SearchingPanel ride={ride} {...sheetProps} />;
    case "NO_DRIVERS_AVAILABLE":
      return ride ? <NoDriversPanel ride={ride} {...sheetProps} /> : null;
    case "DRIVER_MATCHED":
    case "DRIVER_EN_ROUTE":
    case "DRIVER_ARRIVING":
    case "DRIVER_ARRIVED":
      return ride ? <DriverPanel ride={ride} phase={phase} {...sheetProps} /> : null;
    case "TRIP_ACTIVE":
    case "TRIP_PAUSED":
      return ride ? <TripPanel ride={ride} paused={phase === "TRIP_PAUSED"} {...sheetProps} /> : null;
    case "TRIP_COMPLETED":
    case "PAYMENT_FAILED":
      return ride ? <CompletionPanel ride={ride} {...sheetProps} /> : null;
    case "CANCELLED_BY_PASSENGER":
    case "CANCELLED_BY_DRIVER":
    case "CANCELLED_BY_SYSTEM":
      return ride ? <CancelledPanel ride={ride} {...sheetProps} /> : null;
  }
}

/** Reconstructing a trip after reload: geometry-matched skeleton, never a spinner. */
function RestoringSheet(props: { onCoverChange: (cover: { bottom: number; left: number }) => void; bottomOffset: number }) {
  return (
    <RideSheet
      label="Restoring your trip"
      collapsible={false}
      resetKey="restoring"
      {...props}
      peek={
        <div role="status" aria-busy aria-label="Restoring your trip" className="space-y-2 py-1">
          <div className="kx-skeleton h-5 w-40" />
          <div className="kx-skeleton h-3.5 w-56" />
        </div>
      }
    >
      <div className="pb-4">
        <DriverCardSkeleton />
      </div>
    </RideSheet>
  );
}
