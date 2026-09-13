"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { Check, Flag, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusChip, VerifiedBadge } from "@/components/ui/badge";
import { Divider, NestedTile } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { PageLoader } from "@/components/ui/route-loader";
import { MapCanvas } from "@/components/maps/map-canvas";
import { EtaChip } from "@/components/maps/eta-chip";
import { RideSheet, useRideSheetInset } from "@/components/rides/ride-sheet";
import { SeatMap } from "@/components/rides/seat-map";
import { SosButton, SosStatusPanel } from "@/components/safety/sos-button";
import { SosNoteModal } from "@/components/safety/sos-note-modal";
import { useRideSimulation } from "@/features/rides/use-ride-simulation";
import { useCurrentDriver } from "./use-current-driver";
import { DriverTripComplete } from "./driver-trip-complete";
import { queryKeys } from "@/constants/query-keys";
import { rideService } from "@/services";
import {
  PAYMENT_PRESENTATION,
  RIDE_TYPE_LABEL,
  TRACK_LABEL,
  TRACK_TONE,
} from "@/constants/status-presentation";
import {
  DriverTrack,
  RidePassengerState,
  RideType,
  SOSStatus,
} from "@/types/enums";
import { canTransitionSos } from "@/lib/state-machines";
import { formatEta, formatNaira, shortName } from "@/lib/format";
import type { RidePassenger } from "@/types/models";

const PASSENGER_STATE_LABEL: Record<RidePassengerState, string> = {
  [RidePassengerState.AWAITING_PICKUP]: "Waiting to be collected",
  [RidePassengerState.PICKED_UP]: "On board",
  [RidePassengerState.DROPPED_OFF]: "Dropped off",
  [RidePassengerState.NO_SHOW]: "Didn't show",
};

/**
 * The driver's live journey.
 *
 * The map answers "where am I", the sheet answers "who is with me and where
 * are they going". Money appears here only on the professional track, and only
 * as each rider's share — a volunteer driver never sees an amount anywhere on
 * this screen (Product Rule 1).
 */
export function DriverTrip() {
  const router = useRouter();
  const { toast } = useToast();
  const mapInset = useRideSheetInset();

  const { data: driver, isLoading: loadingDriver } = useCurrentDriver();
  const track = driver?.track;

  const { data: trip, isLoading } = useQuery({
    queryKey: queryKeys.driver.activeTrip(track ?? "none"),
    queryFn: () => rideService.getActiveDriverTrip(track!),
    enabled: Boolean(track),
  });

  const [passengers, setPassengers] = useState<RidePassenger[] | null>(null);
  const [sosStatus, setSosStatus] = useState<SOSStatus>(SOSStatus.INACTIVE);
  const [sosNoteOpen, setSosNoteOpen] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completed, setCompleted] = useState(false);

  const transitionSos = useCallback((next: SOSStatus) => {
    setSosStatus((current) => (canTransitionSos(current, next) ? next : current));
  }, []);

  const onArrive = useCallback(() => {
    toast({
      title: "You've reached the destination",
      description: "Drop everyone off, then complete the trip.",
      tone: "success",
    });
  }, [toast]);

  const journey = useRideSimulation({
    route: trip?.route,
    durationSeconds: 45,
    running: Boolean(trip) && !completed,
    onArrive,
  });

  // Memoised so the seat list below doesn't rebuild on every frame of the
  // journey simulation.
  const riders = useMemo(
    () => passengers ?? trip?.passengers ?? [],
    [passengers, trip],
  );

  const seatOccupants = useMemo(
    () =>
      riders
        .filter((rider) => rider.state !== RidePassengerState.NO_SHOW)
        .map((rider) => ({ seatIndex: rider.seatIndex, name: rider.name })),
    [riders],
  );

  if (loadingDriver || isLoading) {
    return <PageLoader message="Loading your journey" />;
  }

  if (!driver || !trip) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon={MapPin}
          title="No journey in progress."
          description="When you accept a request, your live trip appears here."
          action={
            <Button
              variant="primary"
              size="lg"
              onClick={() => router.push("/driver/requests")}
            >
              See ride requests
            </Button>
          }
        />
      </div>
    );
  }

  if (completed) {
    return <DriverTripComplete trip={trip} driver={driver} />;
  }

  const professional = trip.track === DriverTrack.PROFESSIONAL;
  const shared = trip.rideType === RideType.SHARED;
  const onBoard = riders.filter(
    (rider) => rider.state === RidePassengerState.PICKED_UP,
  ).length;
  const etaMinutes = journey.etaMinutes;

  function setRiderState(id: string, state: RidePassengerState) {
    setPassengers(
      riders.map((rider) => (rider.id === id ? { ...rider, state } : rider)),
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapCanvas
        className="absolute inset-0 size-full"
        description={`Live map of your journey to ${trip.destination.label}. ${onBoard} of ${riders.length} passengers on board.`}
        routes={
          trip.route
            ? [
                {
                  id: "journey",
                  path: trip.route,
                  variant: "primary",
                  progress: journey.progress,
                  animateDraw: true,
                },
              ]
            : []
        }
        markers={[
          { id: "destination", position: trip.destination, kind: "destination" },
          ...(journey.position
            ? [
                {
                  id: "vehicle",
                  position: journey.position,
                  kind:
                    sosStatus !== SOSStatus.INACTIVE &&
                    sosStatus !== SOSStatus.RESOLVED
                      ? ("sos" as const)
                      : ("vehicle" as const),
                  heading: journey.heading,
                  track: trip.track,
                },
              ]
            : []),
          ...riders
            .filter((rider) => rider.state === RidePassengerState.AWAITING_PICKUP)
            .map((rider) => ({
              id: rider.id,
              position: rider.pickup,
              kind: "pickup" as const,
              pulse: true,
            })),
        ]}
        viewport={{
          focus: [trip.destination, ...(journey.position ? [journey.position] : [])],
          ...mapInset,
        }}
      >
        {etaMinutes > 0 ? (
          <div className="absolute top-4 left-4 z-20">
            <EtaChip minutes={etaMinutes} label="Arriving in" />
          </div>
        ) : null}
      </MapCanvas>

      <RideSheet
        label="Journey and passengers"
        allowed={["collapsed", "medium", "expanded"]}
        detent="medium"
      >
        {/* Status */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={TRACK_TONE[trip.track]}>
              {TRACK_LABEL[trip.track]}
            </StatusChip>
            <StatusChip tone="neutral">
              {RIDE_TYPE_LABEL[trip.rideType]}
            </StatusChip>
            <StatusChip tone="active" dot live>
              In progress
            </StatusChip>
          </div>

          <AnimatePresence mode="wait">
            <motion.h1
              key={etaMinutes > 0 ? "travelling" : "arriving"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="type-section-title mt-3 text-ink"
            >
              {etaMinutes > 0
                ? `On the way to ${trip.destination.label}.`
                : `Arriving at ${trip.destination.label}.`}
            </motion.h1>
          </AnimatePresence>

          <p className="type-body mt-1.5 text-ink-secondary">
            {etaMinutes > 0 ? `${formatEta(etaMinutes)} remaining · ` : ""}
            {onBoard} of {riders.length} on board
          </p>
        </div>

        <Divider />

        {/* Passengers */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="type-micro text-ink-muted">Passengers</p>
            <span className="type-meta inline-flex items-center gap-1.5 text-ink-secondary">
              <Users className="size-3.5" strokeWidth={1.9} aria-hidden />
              {riders.length} of 3
            </span>
          </div>

          <ul className="mt-3 space-y-2.5">
            {riders.map((rider) => (
              <li key={rider.id}>
                <PassengerRow
                  rider={rider}
                  professional={professional}
                  onPickUp={() =>
                    setRiderState(rider.id, RidePassengerState.PICKED_UP)
                  }
                  onDropOff={() =>
                    setRiderState(rider.id, RidePassengerState.DROPPED_OFF)
                  }
                />
              </li>
            ))}
          </ul>

          {/* Product Rule 2: three seats, and the map cannot render a fourth. */}
          {shared ? (
            <div className="mt-4">
              <SeatMap occupants={seatOccupants} showSummary />
            </div>
          ) : null}

          {professional && shared ? (
            <p className="type-meta mt-3 text-ink-muted">
              Each rider pays their own share. Nothing is collected by you — the
              network settles it.
            </p>
          ) : null}

          {!professional ? (
            <p className="type-meta mt-3 text-ink-muted">
              This journey is given in service. No fare is charged and no
              payment is collected.
            </p>
          ) : null}
        </div>

        {/* SOS, once raised */}
        <SosStatusPanel status={sosStatus} className="mt-5" />

        {/* Complete */}
        <Button
          variant="primary"
          size="lg"
          block
          icon={Flag}
          className="mt-5"
          onClick={() => setConfirmComplete(true)}
        >
          Complete trip
        </Button>

        {/* Safety controls stay last, closest to the thumb. */}
        <div className="sticky bottom-0 -mx-5 mt-6 border-t border-line bg-surface/95 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <p className="type-meta font-medium text-ink">Need help?</p>
              <p className="type-micro mt-0.5 text-ink-muted">
                Hold SOS to alert the safety team
              </p>
            </div>
            <SosButton
              status={sosStatus}
              onActivate={() => {
                transitionSos(SOSStatus.ACTIVATING);
                transitionSos(SOSStatus.SENT);
                setSosNoteOpen(true);

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
      </RideSheet>

      <SosNoteModal
        open={sosNoteOpen}
        onClose={() => setSosNoteOpen(false)}
        onSend={(note) => {
          setSosNoteOpen(false);
          toast({
            title: "Note sent to the safety team",
            description: note,
            tone: "danger",
            durationMs: 6000,
          });
        }}
      />

      <ConfirmDialog
        open={confirmComplete}
        onClose={() => setConfirmComplete(false)}
        onConfirm={() => {
          setConfirmComplete(false);
          setCompleted(true);
        }}
        title="Complete this trip?"
        description={
          onBoard > 0
            ? `${onBoard} ${onBoard === 1 ? "passenger is" : "passengers are"} still marked as on board. Complete it once everyone is out.`
            : "Everyone has been dropped off. This closes the journey."
        }
        confirmLabel="Complete trip"
      />
    </div>
  );
}

function PassengerRow({
  rider,
  professional,
  onPickUp,
  onDropOff,
}: {
  rider: RidePassenger;
  professional: boolean;
  onPickUp: () => void;
  onDropOff: () => void;
}) {
  const awaiting = rider.state === RidePassengerState.AWAITING_PICKUP;
  const onBoard = rider.state === RidePassengerState.PICKED_UP;

  return (
    <NestedTile
      className={cn(
        awaiting && "border-gold-400/40 dark:border-gold-500/30",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar
          name={rider.name}
          src={rider.avatarUrl}
          size="md"
          verified={rider.verified}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="type-body truncate font-medium text-ink">
              {shortName(rider.name)}
            </p>
            {rider.verified ? <VerifiedBadge label="Verified" /> : null}
          </div>

          <p className="type-meta mt-0.5 truncate text-ink-secondary">
            {PASSENGER_STATE_LABEL[rider.state]} · Seat {rider.seatIndex}
          </p>

          <p className="type-meta mt-1 flex items-start gap-1.5 text-ink-muted">
            <MapPin
              className="mt-0.5 size-3.5 shrink-0"
              strokeWidth={1.9}
              aria-hidden
            />
            <span className="min-w-0 truncate">{rider.dropoff.label}</span>
          </p>
        </div>

        {/* Product Rule 1: a share only exists on the professional track. */}
        {professional && rider.fareShare !== undefined ? (
          <div className="shrink-0 text-right">
            <p className="type-numeric text-[0.875rem] font-semibold text-ink">
              {formatNaira(rider.fareShare)}
            </p>
            <StatusChip
              tone={PAYMENT_PRESENTATION[rider.paymentStatus].tone}
              className="mt-1"
            >
              {PAYMENT_PRESENTATION[rider.paymentStatus].label}
            </StatusChip>
          </div>
        ) : null}
      </div>

      {awaiting || onBoard ? (
        <Button
          variant="secondary"
          size="sm"
          icon={Check}
          className="mt-3 w-full"
          onClick={awaiting ? onPickUp : onDropOff}
        >
          {awaiting
            ? `${shortName(rider.name)} is in the car`
            : `Dropped ${shortName(rider.name)} off`}
        </Button>
      ) : null}
    </NestedTile>
  );
}
