"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, MapPin, Share2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Divider, NestedTile } from "@/components/ui/card";
import { MapCanvas } from "@/components/maps/map-canvas";
import { EtaChip } from "@/components/maps/eta-chip";
import { RideSheet, useRideSheetInset } from "@/components/rides/ride-sheet";
import { SeatMap } from "@/components/rides/seat-map";
import { DriverCard } from "@/components/drivers/driver-card";
import { SosButton, SosStatusPanel } from "@/components/safety/sos-button";
import { ShareTripSheet } from "@/components/safety/share-trip-sheet";
import { useRideStore } from "@/stores/ride-store";
import { useSessionStore } from "@/stores/session-store";
import { useRideSimulation } from "@/features/rides/use-ride-simulation";
import { CURRENT_PASSENGER } from "@/mocks/people";
import {
  DriverTrack,
  RideStatus,
  RideType,
  SOSStatus,
} from "@/types/enums";
import { RIDE_STATUS_PRESENTATION } from "@/constants/status-presentation";
import {
  canCancelRide,
  isSosAvailable,
  rideProgressIndex,
  RIDE_PROGRESS_ORDER,
} from "@/lib/state-machines";
import { formatEta, formatMinutes, shortName } from "@/lib/format";
import { transitions } from "@/lib/motion";
import { buildRoute } from "@/lib/geo";

/**
 * The active ride.
 *
 * One screen carries DRIVER_APPROACHING → DRIVER_ARRIVED → IN_PROGRESS →
 * COMPLETED. Two simulated legs run in sequence: the driver's approach to the
 * pickup point, then the journey itself. Status only ever advances through the
 * store's transition guard.
 *
 * SOS and Share Trip stay in the sheet's sticky footer throughout, within one
 * thumb's reach and never behind a menu (Product Rules 5 and 4).
 */
export function ActiveRideScreen() {
  const router = useRouter();
  const { toast } = useToast();

  const track = useRideStore((state) => state.track);
  const rideType = useRideStore((state) => state.rideType);
  const pickup = useRideStore((state) => state.pickup);
  const destination = useRideStore((state) => state.destination);
  const route = useRideStore((state) => state.route);
  const status = useRideStore((state) => state.status);
  const driver = useRideStore((state) => state.driver);
  const sosStatus = useRideStore((state) => state.sosStatus);
  const sharingActive = useRideStore((state) => state.sharingActive);
  const transition = useRideStore((state) => state.transition);
  const transitionSos = useRideStore((state) => state.transitionSos);
  const setSharing = useRideStore((state) => state.setSharing);
  const reset = useRideStore((state) => state.reset);

  const setActiveRide = useSessionStore((state) => state.setActiveRide);

  const mapInset = useRideSheetInset();
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [nearby, setNearby] = useState(false);

  // Deep-linked without a live ride: send them to the request screen.
  useEffect(() => {
    if (!driver || !pickup || !destination) router.replace("/passenger/request");
  }, [driver, pickup, destination, router]);

  /* --- Leg 1: the driver's approach to the pickup point ------------------ */
  // Memoised, not a ref: the route is derived from render inputs, and reading
  // a ref during render is exactly what the compiler warns about.
  const driverOrigin = driver?.currentLocation;
  const approachRoute = useMemo(
    () =>
      pickup && driverOrigin
        ? buildRoute(driverOrigin, pickup, { seed: "approach" })
        : undefined,
    [pickup, driverOrigin],
  );

  const approaching = status === RideStatus.DRIVER_APPROACHING;

  const onArrivedAtPickup = useCallback(() => {
    transition(RideStatus.DRIVER_ARRIVED);
    toast({
      title: "Your driver has arrived",
      description: "They're waiting at the pickup point.",
      tone: "success",
    });
  }, [transition, toast]);

  const approach = useRideSimulation({
    route: approachRoute,
    durationSeconds: 20,
    running: approaching,
    nearThreshold: 0.72,
    onNear: () => setNearby(true),
    onArrive: onArrivedAtPickup,
  });

  /* --- Leg 2: the journey itself ----------------------------------------- */
  const inProgress = status === RideStatus.IN_PROGRESS;

  const onJourneyComplete = useCallback(() => {
    transition(RideStatus.COMPLETED);
    setActiveRide(null);
  }, [transition, setActiveRide]);

  const journey = useRideSimulation({
    route: route ?? undefined,
    durationSeconds: 38,
    running: inProgress,
    onArrive: onJourneyComplete,
  });

  // Keep the persistent indicator's remaining time in step with the journey.
  useEffect(() => {
    if (inProgress) setActiveRide("active", journey.etaMinutes);
  }, [inProgress, journey.etaMinutes, setActiveRide]);

  if (!driver || !pickup || !destination) return null;

  const presentation = RIDE_STATUS_PRESENTATION[status];
  const arrived = status === RideStatus.DRIVER_ARRIVED;
  const completed = status === RideStatus.COMPLETED;

  const etaMinutes = approaching
    ? approach.etaMinutes
    : inProgress
      ? journey.etaMinutes
      : 0;

  const vehiclePosition = approaching
    ? approach.position
    : inProgress
      ? journey.position
      : arrived
        ? pickup
        : destination;

  const vehicleHeading = approaching ? approach.heading : journey.heading;

  const activeRouteSpec = approaching
    ? approachRoute
      ? [
          {
            id: "approach",
            path: approachRoute,
            variant: "primary" as const,
            progress: approach.progress,
            animateDraw: true,
          },
          ...(route
            ? [{ id: "journey-preview", path: route, variant: "alternate" as const }]
            : []),
        ]
      : []
    : route
      ? [
          {
            id: "journey",
            path: route,
            variant: "primary" as const,
            progress: inProgress ? journey.progress : completed ? 1 : 0,
            animateDraw: true,
          },
        ]
      : [];

  /* --- Status headline --------------------------------------------------- */
  const headline = completed
    ? "You've arrived."
    : arrived
      ? "Your driver has arrived."
      : approaching && nearby
        ? "Your driver is nearby."
        : approaching
          ? `${shortName(driver.fullName)} is on the way.`
          : inProgress
            ? `On the way to ${destination.label}.`
            : presentation.label;

  const subline = completed
    ? `${destination.label} · ${formatMinutes(route?.durationMinutes ?? 0)}`
    : arrived
      ? `Look for a ${driver.vehicle.colour.toLowerCase()} ${driver.vehicle.make} ${driver.vehicle.model}, plate ${driver.vehicle.plateNumber}.`
      : approaching
        ? `Arriving in ${formatEta(approach.etaMinutes)}`
        : inProgress
          ? `${formatEta(journey.etaMinutes)} remaining`
          : (presentation.detail ?? "");

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapCanvas
        className="absolute inset-0 size-full"
        description={`Live map of your journey from ${pickup.label} to ${destination.label}. ${headline} ${subline}`}
        routes={activeRouteSpec}
        markers={[
          {
            id: "pickup",
            position: pickup,
            kind: "pickup",
            pulse: approaching || arrived,
          },
          { id: "destination", position: destination, kind: "destination" },
          ...(vehiclePosition
            ? [
                {
                  id: "vehicle",
                  position: vehiclePosition,
                  kind:
                    sosStatus !== SOSStatus.INACTIVE &&
                    sosStatus !== SOSStatus.RESOLVED
                      ? ("sos" as const)
                      : ("vehicle" as const),
                  heading: vehicleHeading,
                  track: driver.track,
                },
              ]
            : []),
        ]}
        // Zoom in a little as the driver closes on the pickup point, and keep
        // everything clear of the desktop panel.
        viewport={
          approaching && nearby && vehiclePosition
            ? {
                focus: [pickup, vehiclePosition],
                padding: 0.5,
                ...mapInset,
              }
            : {
                focus: [pickup, destination],
                ...mapInset,
              }
        }
      >
        {/* ETA chip */}
        {!completed && !arrived ? (
          <div className="absolute top-4 left-4 z-20">
            <EtaChip
              minutes={etaMinutes}
              label={approaching ? "Driver arriving in" : "Arriving in"}
            />
          </div>
        ) : null}

        {/* Live sharing indicator */}
        {sharingActive ? (
          <div className="absolute top-4 right-4 z-20 lg:right-[calc(min(400px,38vw)+2rem)]">
            <span className="surface-glass inline-flex items-center gap-2 rounded-full px-3 py-2">
              <span className="relative flex size-1.5">
                <span
                  className="absolute inline-flex size-full rounded-full bg-success-500"
                  style={{ animation: "kx-pulse-ring 2s ease-out infinite" }}
                  aria-hidden
                />
                <span className="relative inline-flex size-1.5 rounded-full bg-success-500" />
              </span>
              <span className="type-micro text-ink">Sharing live</span>
            </span>
          </div>
        ) : null}
      </MapCanvas>

      <RideSheet
        label="Journey details"
        allowed={["collapsed", "medium", "expanded"]}
        detent="medium"
      >
        {/* Status */}
        <div>
          <div className="flex items-center gap-2">
            <StatusChip
              tone={presentation.tone}
              dot
              live={approaching || inProgress}
            >
              {presentation.label}
            </StatusChip>
            {rideType === RideType.SHARED ? (
              <StatusChip tone="neutral">Shared</StatusChip>
            ) : null}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={headline}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={transitions.card}
            >
              <h1 className="type-section-title mt-3 text-ink">{headline}</h1>
              <p className="type-body mt-1.5 text-ink-secondary">{subline}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Journey progress rail */}
        <RideProgress status={status} className="mt-5" />

        <Divider />

        {/* Driver — emphasised while they're closing in */}
        <DriverCard
          driver={driver}
          emphasiseVehicle={arrived || (approaching && nearby)}
        />

        {/* Route */}
        <div className="mt-5 space-y-2.5">
          <NestedTile className="flex items-start gap-3">
            <span className="mt-1 size-2.5 shrink-0 rounded-full border-2 border-forest-700 dark:border-gold-400" aria-hidden />
            <div className="min-w-0">
              <p className="type-micro text-ink-muted">Pickup</p>
              <p className="type-body truncate font-medium text-ink">
                {pickup.label}
              </p>
            </div>
          </NestedTile>

          <NestedTile className="flex items-start gap-3">
            <MapPin
              className="mt-0.5 size-4 shrink-0 text-forest-700 dark:text-gold-400"
              strokeWidth={2}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="type-micro text-ink-muted">Destination</p>
              <p className="type-body truncate font-medium text-ink">
                {destination.label}
              </p>
            </div>
          </NestedTile>
        </div>

        {/* Shared-ride passengers */}
        {rideType === RideType.SHARED ? (
          <div className="mt-5">
            <p className="type-micro mb-2.5 text-ink-muted">Who&rsquo;s travelling</p>
            <SeatMap
              occupants={[{ seatIndex: 1, name: "You" }]}
              showSummary
            />
          </div>
        ) : null}

        {/* SOS status, once raised */}
        <SosStatusPanel status={sosStatus} className="mt-5" />

        {/* Arrival confirmation */}
        {arrived ? (
          <Button
            variant="primary"
            size="lg"
            block
            className="mt-5"
            icon={Check}
            onClick={() => {
              transition(RideStatus.IN_PROGRESS);
              toast({ title: "Journey started", tone: "success" });
            }}
          >
            I&rsquo;m at the pickup point
          </Button>
        ) : null}

        {/* Completion */}
        {completed ? (
          <div className="mt-5 space-y-2.5">
            <NestedTile>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="type-micro text-ink-muted">Duration</p>
                  <p className="type-numeric mt-1 text-[0.9375rem] font-semibold text-ink">
                    {formatMinutes(route?.durationMinutes ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="type-micro text-ink-muted">Track</p>
                  <p className="type-meta mt-1 font-semibold text-ink">
                    {track === DriverTrack.VOLUNTEER
                      ? "Volunteer"
                      : "Professional"}
                  </p>
                </div>
              </div>
            </NestedTile>

            {/* Product Rule 1: no payment panel on a volunteer ride. */}
            {track === DriverTrack.VOLUNTEER ? (
              <p className="type-meta rounded-[var(--kx-radius-md)] border border-gold-200/70 bg-gold-50/60 px-4 py-3 text-ink-secondary dark:border-gold-700/30 dark:bg-gold-500/8">
                This journey was given in service. Nothing to pay.
              </p>
            ) : null}

            <Button
              variant="primary"
              size="lg"
              block
              iconRight={ArrowRight}
              onClick={() => {
                reset();
                router.push("/passenger");
              }}
            >
              Done
            </Button>
          </div>
        ) : null}

        {/* Cancel, only while it's still legal */}
        {canCancelRide(status) && !arrived ? (
          <Button
            variant="ghost"
            size="md"
            block
            className="mt-4"
            onClick={() => setConfirmCancel(true)}
          >
            Cancel ride
          </Button>
        ) : null}

        {/* Persistent safety controls — always the last thing in the sheet,
            so they sit closest to the thumb on mobile. */}
        {isSosAvailable(status) ? (
          <div className="sticky bottom-0 -mx-5 mt-6 border-t border-line bg-surface/95 px-5 py-4 backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <Button
                variant="secondary"
                size="lg"
                icon={Share2}
                className="flex-1"
                onClick={() => setShareOpen(true)}
              >
                Share Trip
              </Button>
              <SosButton
                status={sosStatus}
                onActivate={() => {
                  transitionSos(SOSStatus.ACTIVATING);
                  transitionSos(SOSStatus.SENT);
                  toast({
                    title: "Emergency alert sent",
                    description:
                      "Your location has been shared with the safety team.",
                    tone: "danger",
                    durationMs: 6000,
                  });

                  // Simulated acknowledgement, then response.
                  window.setTimeout(
                    () => transitionSos(SOSStatus.ACKNOWLEDGED),
                    2600,
                  );
                  window.setTimeout(
                    () => transitionSos(SOSStatus.RESPONDING),
                    5200,
                  );
                }}
              />
            </div>
          </div>
        ) : null}
      </RideSheet>

      <ShareTripSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl="https://koinonia-vtn.example/trip/2296"
        trustedContacts={CURRENT_PASSENGER.trustedContacts}
        sharingActive={sharingActive}
        onSharingChange={setSharing}
      />

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => {
          transition(RideStatus.CANCELLED);
          setActiveRide(null);
          setConfirmCancel(false);
          reset();
          toast({ title: "Ride cancelled" });
          router.replace("/passenger");
        }}
        title="Cancel this ride?"
        description="Your driver is already on the way. Cancelling now lets them know you no longer need the ride."
        confirmLabel="Cancel ride"
        cancelLabel="Keep my ride"
        tone="danger"
      />
    </div>
  );
}

/** Compact rail showing where the journey has got to. */
function RideProgress({
  status,
  className,
}: {
  status: RideStatus;
  className?: string;
}) {
  const currentIndex = rideProgressIndex(status);

  const labels: Partial<Record<RideStatus, string>> = {
    [RideStatus.SEARCHING]: "Matched",
    [RideStatus.MATCHED]: "Confirmed",
    [RideStatus.DRIVER_APPROACHING]: "On the way",
    [RideStatus.DRIVER_ARRIVED]: "Arrived",
    [RideStatus.IN_PROGRESS]: "Travelling",
    [RideStatus.COMPLETED]: "Complete",
  };

  return (
    <ol className={cn("flex items-center gap-1.5", className)}>
      {RIDE_PROGRESS_ORDER.map((step, index) => {
        const done = index <= currentIndex;
        const active = index === currentIndex;

        return (
          <li key={step} className="flex-1">
            <span
              className={cn(
                "block h-1 rounded-full transition-colors duration-[280ms]",
                done
                  ? "bg-forest-600 dark:bg-gold-500"
                  : "bg-[color-mix(in_srgb,var(--kx-text)_10%,transparent)]",
              )}
            />
            <span
              className={cn(
                "type-micro mt-1.5 block truncate",
                active ? "text-ink" : "text-ink-muted",
              )}
            >
              {active ? labels[step] : ""}
            </span>
            <span className="sr-only">
              {labels[step]} {done ? "complete" : "pending"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
