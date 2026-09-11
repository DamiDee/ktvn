"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, KeyRound, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/badge";
import { RouteLoader } from "@/components/ui/route-loader";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { MapCanvas } from "@/components/maps/map-canvas";
import { RideSheet, useRideSheetInset } from "@/components/rides/ride-sheet";
import { NoMatchState } from "@/components/rides/no-match-state";
import { DriverCard, DriverCardSearching } from "@/components/drivers/driver-card";
import { rideService } from "@/services";
import { NEARBY_DRIVER_POSITIONS } from "@/mocks/people";
import { useRideStore } from "@/stores/ride-store";
import { useSessionStore } from "@/stores/session-store";
import { useSafetyStore } from "@/stores/safety-store";
import { DriverTrack, RideStatus, RideType } from "@/types/enums";
import { RIDE_STATUS_PRESENTATION } from "@/constants/status-presentation";
import { shortName } from "@/lib/format";
import { transitions } from "@/lib/motion";

/** Rotating reassurance while the search runs — calm, never alarming. */
const SEARCH_MESSAGES = [
  "Finding verified drivers nearby",
  "Looking for drivers heading your direction",
  "Checking available routes",
];

export function MatchingScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const mapInset = useRideSheetInset();

  const track = useRideStore((state) => state.track);
  const rideType = useRideStore((state) => state.rideType);
  const pickup = useRideStore((state) => state.pickup);
  const destination = useRideStore((state) => state.destination);
  const route = useRideStore((state) => state.route);
  const status = useRideStore((state) => state.status);
  const driver = useRideStore((state) => state.driver);
  const transition = useRideStore((state) => state.transition);
  const setDriver = useRideStore((state) => state.setDriver);
  const setTrack = useRideStore((state) => state.setTrack);
  const setRideType = useRideStore((state) => state.setRideType);
  const setEta = useRideStore((state) => state.setEta);
  const setSharing = useRideStore((state) => state.setSharing);
  const setActiveRide = useSessionStore((state) => state.setActiveRide);
  const autoShare = useSafetyStore((state) => state.autoShare);
  const selectedContactIds = useSafetyStore((state) => state.selectedContactIds);

  const [confirmCancel, setConfirmCancel] = useState(false);
  /** Bumped to run the search again; also the effect's only trigger. */
  const [attempt, setAttempt] = useState(0);
  const cancelledRef = useRef(false);

  // No destination means the passenger deep-linked here; send them back.
  useEffect(() => {
    if (!destination || !pickup) router.replace("/passenger/request");
  }, [destination, pickup, router]);

  /**
   * The search owns its own AbortController per run, and the cleanup aborts
   * only that run. A "have we started" latch would break under StrictMode's
   * double-invoked effects — the first run gets aborted and the latch stops
   * the second from ever starting.
   */
  useEffect(() => {
    if (!destination || cancelledRef.current) return;

    const controller = new AbortController();
    let stale = false;

    transition(RideStatus.SEARCHING);
    setDriver(null);

    (async () => {
      try {
        const found = await rideService.findDriver(track, {
          signal: controller.signal,
        });

        if (stale || controller.signal.aborted) return;

        if (found) {
          setDriver(found);
          setEta(
            route ? Math.max(2, Math.round(route.durationMinutes * 0.2)) : 4,
          );
          transition(RideStatus.MATCHED);
        } else {
          transition(RideStatus.NO_MATCH);
        }
      } catch {
        // An aborted search is a normal consequence of cancelling or
        // re-running, not a failure worth surfacing.
        if (!stale && !controller.signal.aborted) {
          transition(RideStatus.NO_MATCH);
        }
      }
    })();

    return () => {
      stale = true;
      controller.abort();
    };
  }, [attempt, destination, track, route, transition, setDriver, setEta]);

  const searchAgain = useCallback(() => setAttempt((n) => n + 1), []);

  function cancelSearch() {
    cancelledRef.current = true;
    transition(RideStatus.CANCELLED);
    setConfirmCancel(false);
    toast({ title: "Search cancelled" });
    router.replace("/passenger/request");
  }

  function beginJourney(forceSharing = false) {
    if (!driver) return;
    const shouldShare = forceSharing || (autoShare && selectedContactIds.length > 0);
    setSharing(shouldShare);
    setActiveRide("active", route?.durationMinutes);
    transition(RideStatus.DRIVER_APPROACHING);
    if (shouldShare) {
      toast({
        title: forceSharing ? "Trip sharing is ready" : "Safety circle notified",
        description: forceSharing
          ? "Your live link will stay active for this journey."
          : `${selectedContactIds.length} trusted ${selectedContactIds.length === 1 ? "contact has" : "contacts have"} the live link.`,
        tone: "success",
      });
    }
    router.push("/passenger/trip");
  }

  if (!pickup || !destination) return null;

  const searching =
    status === RideStatus.REQUESTING ||
    status === RideStatus.SEARCHING ||
    status === RideStatus.AWAITING_DRIVER;

  const matched = status === RideStatus.MATCHED;
  const noMatch = status === RideStatus.NO_MATCH;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapCanvas
        className="absolute inset-0 size-full"
        description={
          matched && driver
            ? `Map showing ${shortName(driver.fullName)} matched for your journey to ${destination.label}.`
            : `Map showing your pickup point at ${pickup.label} while a driver is found.`
        }
        searching={searching}
        viewport={{ focus: [pickup, destination], ...mapInset }}
        routes={
          route
            ? [
                {
                  id: "journey",
                  path: route,
                  variant: matched ? "primary" : "alternate",
                  animateDraw: matched,
                },
              ]
            : []
        }
        markers={[
          { id: "pickup", position: pickup, kind: "passenger", pulse: true },
          { id: "destination", position: destination, kind: "destination" },
          // Nearby drivers appear only while searching, then clear on match.
          ...(searching
            ? NEARBY_DRIVER_POSITIONS.map((nearby) => ({
                id: nearby.id,
                position: { lat: nearby.lat, lng: nearby.lng },
                kind:
                  nearby.track === track
                    ? ("driver-moving" as const)
                    : ("driver-idle" as const),
                track: nearby.track,
              }))
            : []),
          ...(matched && driver?.currentLocation
            ? [
                {
                  id: "matched-driver",
                  position: driver.currentLocation,
                  kind: "vehicle" as const,
                  heading: driver.heading ?? 0,
                  track: driver.track,
                },
              ]
            : []),
        ]}
      />

      <RideSheet
        label="Ride matching"
        allowed={["medium", "expanded"]}
        detent="medium"
      >
        <AnimatePresence mode="wait">
          {searching ? (
            <motion.div
              key="searching"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={transitions.card}
            >
              <StatusChip tone="info" dot live>
                {RIDE_STATUS_PRESENTATION[RideStatus.SEARCHING].label}
              </StatusChip>

              <h1 className="type-section-title mt-3.5 text-ink">
                Finding a verified driver
              </h1>
              <p className="type-body mt-2 text-ink-secondary">
                Looking for someone already heading toward{" "}
                <span className="font-medium text-ink">
                  {destination.area ?? destination.label}
                </span>
                .
              </p>

              <RouteLoader
                messages={SEARCH_MESSAGES}
                size="md"
                className="my-7"
              />

              <DriverCardSearching />

              <Button
                variant="subtle"
                size="lg"
                block
                icon={X}
                className="mt-7"
                onClick={() => setConfirmCancel(true)}
              >
                Cancel Search
              </Button>
            </motion.div>
          ) : null}

          {noMatch ? (
            <motion.div
              key="no-match"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={transitions.card}
              className="py-2"
            >
              <NoMatchState
                track={track}
                rideType={rideType}
                destinationLabel={destination.area ?? destination.label}
                actions={{
                  onSearchAgain: searchAgain,
                  onTryProfessional: () => {
                    // Changing the track re-runs the effect on its own, but the
                    // bump keeps the behaviour identical whichever path is taken.
                    setTrack(DriverTrack.PROFESSIONAL);
                    searchAgain();
                  },
                  onChoosePrivate: () => {
                    setRideType(RideType.PRIVATE);
                    searchAgain();
                  },
                  onChangeDestination: () => router.push("/passenger/request"),
                }}
              />
            </motion.div>
          ) : null}

          {matched && driver ? (
            <motion.div
              key="matched"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={transitions.springGentle}
            >
              <StatusChip tone="active" dot>
                {RIDE_STATUS_PRESENTATION[RideStatus.MATCHED].label}
              </StatusChip>

              <h1 className="type-section-title mt-3.5 text-ink">
                Your driver
              </h1>
              <p className="type-body mt-2 text-ink-secondary">
                {shortName(driver.fullName)} is confirmed for your journey to{" "}
                {destination.label}.
              </p>

              <div className="mt-5">
                <DriverCard driver={driver} />
              </div>

              <div className="mt-4 flex items-start gap-2.5 rounded-[var(--kx-radius-md)] border border-line bg-surface-nested px-3.5 py-3">
                <KeyRound
                  className="mt-0.5 size-4 shrink-0 text-forest-700 dark:text-gold-400"
                  strokeWidth={1.9}
                  aria-hidden
                />
                <p className="type-meta text-ink-secondary">
                  Your four-digit boarding PIN appears when the driver arrives.
                  Confirm the car and plate before sharing it.
                </p>
              </div>

              <div className="mt-6 space-y-2.5">
                <Button
                  variant="primary"
                  size="lg"
                  block
                  iconRight={ArrowRight}
                  onClick={() => beginJourney()}
                >
                  View Journey
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  block
                  icon={Share2}
                  onClick={() => beginJourney(true)}
                >
                  Share Trip
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  block
                  onClick={() => setConfirmCancel(true)}
                >
                  Cancel ride
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </RideSheet>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={cancelSearch}
        title={matched ? "Cancel this ride?" : "Cancel the search?"}
        description={
          matched
            ? "Your driver has already been matched and may be on their way. Cancelling now lets them know you no longer need the ride."
            : "We'll stop looking for a driver. You can start a new request whenever you're ready."
        }
        confirmLabel={matched ? "Cancel ride" : "Cancel search"}
        cancelLabel="Keep looking"
        tone="danger"
      />
    </div>
  );
}
