"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { FluidAccent } from "@/components/ui/fluid-accent";
import { MessageCircle, Navigation, Phone, Power, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { PAID_RIDES_CONFIG, PAID_RIDES_FEATURES } from "../config";
import { ERROR_COPY } from "../domain/errors";
import { firstName, formatArrivalClock, formatDistance, formatDuration, formatMoney } from "../domain/format";
import type { GeoPoint, Ride, Viewer } from "../domain/types";
import { driverOnlineEligibility } from "../domain/account-profile";
import { ActionTile } from "../components/action-tile";
import { PinCharacter } from "../components/characters";
import { RideSheet } from "../components/ride-sheet";
import { EtaValue, MetricRow, PersonAvatar, RatingPill, RouteStops, WaitingNote } from "../components/ride-ui";
import { SafetyCenter } from "../safety/safety-center";
import { useDriverStore } from "../state/driver-store";
import { useDriverPresenceStore } from "../state/driver-presence-store";

/**
 * Driver sheets. Read at a glance, one-handed, in a car: one primary action
 * per state, large and in the thumb zone; everything else is secondary.
 */

type CoverProps = { onCoverChange: (cover: { bottom: number; left: number }) => void; bottomOffset: number };

/** Opens turn-by-turn in the device's maps app; the in-app map shows the route too. */
function navigationHref(point: GeoPoint): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=driving`;
}

export function AvailabilityPanel({ online, transitioning, onCoverChange, bottomOffset, viewer }: CoverProps & { online: boolean; transitioning: boolean; viewer?: Viewer }) {
  const setOnline = useDriverStore((store) => store.setOnline);
  const error = useDriverStore((store) => store.state.availabilityError);
  const connected = useDriverStore((store) => store.state.ride.connection === "open");
  const presenceReady = useDriverPresenceStore((store) => store.phase === "ready");
  const ready = online && connected && presenceReady;
  const statusLabel = online ? ready ? "You're online" : "Reconnecting" : "You're offline";
  const eligibility = driverOnlineEligibility(viewer);

  return (
    <RideSheet
      label={statusLabel}
      collapsible={false}
      onCoverChange={onCoverChange}
      bottomOffset={bottomOffset}
      resetKey={online ? "online" : "offline"}
      peek={
        <div className="relative isolate">
        <FluidAccent className="opacity-60" />
        <div className="relative">
        <div className="mb-6 hidden items-center justify-between lg:flex"><Brand /><span className="ride-caption">Driver workspace</span></div>
        {viewer ? <Link href="/rides/driver/account" className="mb-4 flex items-center gap-3">
          <PersonAvatar name={viewer.displayName} src={viewer.avatarUrl} size={44} />
          <div className="min-w-0"><p className="ride-body font-semibold">Hello, {firstName(viewer.displayName)}.</p><p className="ride-caption">{viewer.vehicle ? `${viewer.vehicle.make} ${viewer.vehicle.model} · ${viewer.vehicle.plate}` : "View your driver profile"}</p></div>
        </Link> : null}
        <div className="flex items-center gap-4 pt-1">
          <span className="relative flex size-12 shrink-0 items-center justify-center">
            {ready ? <span className="ride-pulse-ring absolute inset-0 rounded-full bg-[var(--ride-success)] opacity-30" /> : null}
            <span className={cn("relative size-4 rounded-full", ready ? "bg-[var(--ride-success)]" : online ? "bg-amber-500" : "bg-[var(--kx-neutral-400)]")} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="ride-heading-lg">{statusLabel}</h2>
            <p className="ride-body-sm text-[var(--text-secondary)]">
              {online ? ready ? "Waiting for ride requests near you" : "Restoring your connection and live location" : "Go online to start receiving ride requests"}
            </p>
          </div>
        </div>
        </div>
        </div>
      }
      footer={
        <div className="space-y-2">
          {!online && !eligibility.allowed ? <p role="status" className="ride-body-sm text-[var(--text-secondary)]">{eligibility.message} <Link href="/rides/driver/account" className="font-semibold underline">View account</Link></p> : null}
          {error ? (
            <p role="alert" className="ride-body-sm text-[var(--ride-danger)]">
              {ERROR_COPY[error].title}. {ERROR_COPY[error].body}
            </p>
          ) : null}
          {online ? (
            <Button size="xl" block pill variant="subtle" icon={Power} loading={transitioning} loadingLabel="Going offline" onClick={() => void setOnline(false)}>
              Go offline
            </Button>
          ) : (
            <Button size="xl" block pill icon={Power} disabled={!eligibility.allowed} loading={transitioning} loadingLabel="Going online" onClick={() => { if (eligibility.allowed) void setOnline(true); }}>
              Go online
            </Button>
          )}
        </div>
      }
    >
      {!online ? <div className="mb-5 hidden lg:block"><div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-3xl"><Image src="/images/krides-driver-premium.webp" alt="A professional driver ready to welcome his next passenger." fill sizes="380px" className="object-cover" /></div><h1 className="mt-5 text-3xl leading-tight font-medium tracking-[-.05em]">Your time.<br />Your next opportunity.</h1><p className="ride-body-sm mt-3 text-[var(--text-secondary)]">Go online when you’re ready. Your next request will appear here.</p></div> : null}
      <p className="ride-caption pb-2">
        {online
          ? "Your location is shared with K-Rides while you're online, so nearby riders can be matched to you."
          : "Your location isn't shared while you're offline."}
      </p>
    </RideSheet>
  );
}

function PassengerRow({ ride }: { ride: Ride }) {
  const passenger = ride.passenger;
  if (!passenger) return null;
  return (
    <div className="flex items-center gap-3">
      <PersonAvatar name={passenger.displayName} src={passenger.avatarUrl} size={48} />
      <div className="min-w-0 flex-1">
        <p className="ride-heading-md truncate">{passenger.displayName}</p>
        <p className="ride-caption">
          {ride.option.name}
          {ride.option.shared ? " · Shared" : ""}
        </p>
      </div>
      {passenger.rating ? <RatingPill rating={passenger.rating} /> : null}
    </div>
  );
}

function ContactRow({ ride, onSafety }: { ride: Ride; onSafety: () => void }) {
  const unread = useDriverStore((store) => store.state.ride.unread);
  const contact = ride.passenger?.contact;
  return (
    <div className="flex gap-2">
      {contact && contact.call !== "none" && contact.callHref ? <ActionTile icon={Phone} label="Call" href={contact.callHref} /> : null}
      {contact?.chat && PAID_RIDES_FEATURES.chat ? <ActionTile icon={MessageCircle} label="Message" href="/rides/driver/messages" badge={unread} /> : null}
      <ActionTile icon={ShieldCheck} label="Safety" tone="safety" onClick={onSafety} />
    </div>
  );
}

function ActionError() {
  const error = useDriverStore((store) => store.state.ride.error);
  if (!error || error.action === "bootstrap") return null;
  return (
    <p role="alert" className="ride-body-sm text-[var(--ride-danger)]">
      {ERROR_COPY[error.code].title}. {ERROR_COPY[error.code].body}
    </p>
  );
}

/** EN_ROUTE_TO_PICKUP and ARRIVED_AT_PICKUP. */
export function PickupPanel({ ride, arrived, onCoverChange, bottomOffset }: CoverProps & { ride: Ride; arrived: boolean }) {
  const rideAction = useDriverStore((store) => store.rideAction);
  const cancelRide = useDriverStore((store) => store.cancelRide);
  const pending = useDriverStore((store) => store.state.ride.pending);
  const [safety, setSafety] = useState(false);
  const [confirmArrive, setConfirmArrive] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pin, setPin] = useState("");
  const [waited, setWaited] = useState(0);
  const name = ride.passenger ? firstName(ride.passenger.displayName) : "your rider";
  const distance = ride.approach?.distanceMeters ?? null;
  const far = distance !== null && distance > PAID_RIDES_CONFIG.arrivingThresholdMeters;

  useEffect(() => {
    if (!arrived || !ride.timestamps.arrivedAt) return;
    const since = Date.parse(ride.timestamps.arrivedAt);
    const tick = () => setWaited(Math.max(0, Math.floor((Date.now() - since) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [arrived, ride.timestamps.arrivedAt]);

  return (
    <RideSheet
      label={arrived ? "Waiting at pickup" : "Pick up your rider"}
      onCoverChange={onCoverChange}
      bottomOffset={bottomOffset}
      resetKey={arrived ? "arrived" : "pickup"}
      maxHeight="60dvh"
      peek={
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="ride-caption">{arrived ? `Waiting for ${name}` : `Picking up ${name}`}</p>
            <p className="ride-heading-md truncate">{ride.pickup.name}</p>
            <p className="ride-caption truncate">{ride.pickup.secondary}</p>
          </div>
          {arrived ? (
            <div className="text-right" aria-live="off">
              <p className="ride-num text-[1.75rem] leading-none font-semibold">
                {Math.floor(waited / 60)}:{String(waited % 60).padStart(2, "0")}
              </p>
              <p className="ride-caption">waiting</p>
            </div>
          ) : ride.approach ? (
            <div className="text-right">
              <EtaValue seconds={ride.approach.etaSeconds} size="lg" />
              <p className="ride-caption ride-num">{formatDistance(ride.approach.distanceMeters)}</p>
            </div>
          ) : null}
        </div>
      }
      footer={
        <div className="space-y-2">
          <ActionError />
          {arrived ? (
            <>
              <WaitingNote ride={ride} className="text-center" />
              {PAID_RIDES_CONFIG.tripPinRequired ? (
                <input
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label="Rider's trip PIN"
                  placeholder="Rider's 4-digit PIN"
                  className="ride-num h-12 w-full rounded-[var(--ride-radius-md)] border border-[var(--border-strong)] bg-[var(--surface-primary)] text-center text-[1.25rem] tracking-[0.3em]"
                />
              ) : null}
              <Button
                size="xl"
                block
                pill
                loading={pending === "start"}
                loadingLabel="Starting"
                disabled={PAID_RIDES_CONFIG.tripPinRequired && pin.length !== 4}
                onClick={() => void rideAction("start", pin || null)}
              >
                Start ride
              </Button>
            </>
          ) : (
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <a
                href={navigationHref(ride.pickup.point)}
                target="_blank"
                rel="noopener noreferrer"
                className="ride-press flex h-15 items-center gap-2 rounded-full bg-[var(--surface-secondary)] px-5 font-semibold"
              >
                <Navigation className="size-5" aria-hidden />
                Navigate
              </a>
              <Button size="xl" pill loading={pending === "arrive"} loadingLabel="Confirming" onClick={() => (far ? setConfirmArrive(true) : void rideAction("arrive"))}>
                I&apos;ve arrived
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-5 pb-3">
        <PassengerRow ride={ride} />
        <ContactRow ride={ride} onSafety={() => setSafety(true)} />
        <RouteStops pickup={ride.pickup} destination={ride.destination} />
        {!arrived ? (
          <button type="button" onClick={() => setConfirmCancel(true)} className="ride-press w-full rounded-full py-3 font-semibold text-[var(--ride-danger)]">
            Cancel this trip
          </button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmArrive}
        onClose={() => setConfirmArrive(false)}
        onConfirm={() => {
          setConfirmArrive(false);
          void rideAction("arrive");
        }}
        title="You're still a little way off"
        description={`You look about ${distance !== null ? formatDistance(distance) : "some distance"} from the pickup. ${name} will be told you've arrived.`}
        confirmLabel="I've arrived"
        cancelLabel="Keep driving"
      />
      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          void cancelRide("driver_cancelled_before_pickup");
        }}
        title="Cancel this trip?"
        description={`${name} will be matched with another driver. Frequent cancellations affect your standing.`}
        confirmLabel="Cancel trip"
        cancelLabel="Keep trip"
        tone="danger"
      />
      <Modal open={safety} onClose={() => setSafety(false)} title="Safety" size="sm">
        <SafetyCenter ride={ride} role="driver" sosAcknowledged={false} />
      </Modal>
    </RideSheet>
  );
}

/** TRIP_ACTIVE (driver): destination, ETA, remaining, complete. */
export function DriverTripPanel({ ride, onCoverChange, bottomOffset }: CoverProps & { ride: Ride }) {
  const rideAction = useDriverStore((store) => store.rideAction);
  const pending = useDriverStore((store) => store.state.ride.pending);
  const sosAcknowledged = useDriverStore((store) => store.state.ride.sosAcknowledged);
  const [confirm, setConfirm] = useState(false);
  const [safety, setSafety] = useState(false);
  const eta = ride.progress?.etaSeconds ?? ride.route.durationSeconds;
  const remaining = ride.progress?.remainingMeters ?? ride.route.distanceMeters;
  const nearlyThere = remaining < 400;

  return (
    <RideSheet
      label="Trip in progress"
      onCoverChange={onCoverChange}
      bottomOffset={bottomOffset}
      resetKey="driver-trip"
      maxHeight="52dvh"
      peek={
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="ride-caption">Drop off {ride.passenger ? firstName(ride.passenger.displayName) : "rider"} at</p>
            <p className="ride-heading-md truncate">{ride.destination.name}</p>
            <p className="ride-caption ride-num">{formatDistance(remaining)} · arrive {formatArrivalClock(eta)}</p>
          </div>
          <EtaValue seconds={eta} size="lg" />
        </div>
      }
      footer={
        <div className="space-y-2">
          <ActionError />
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <a
              href={navigationHref(ride.destination.point)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Navigate to destination"
              className="ride-press flex h-15 w-15 items-center justify-center rounded-full bg-[var(--surface-secondary)]"
            >
              <Navigation className="size-5" aria-hidden />
            </a>
            <Button size="xl" pill variant={nearlyThere ? "primary" : "subtle"} loading={pending === "complete"} loadingLabel="Completing" onClick={() => setConfirm(true)}>
              Complete ride
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 pb-3">
        <ContactRow ride={ride} onSafety={() => setSafety(true)} />
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void rideAction("complete");
        }}
        title={nearlyThere ? "Complete this ride?" : "You haven't reached the destination yet"}
        description={nearlyThere ? "The rider will be charged and asked to rate the trip." : `You're about ${formatDistance(remaining)} away. Only complete early if the rider asked to be dropped here.`}
        confirmLabel="Complete ride"
        cancelLabel="Not yet"
      />
      <Modal open={safety} onClose={() => setSafety(false)} title="Safety" size="sm">
        <SafetyCenter ride={ride} role="driver" sosAcknowledged={sosAcknowledged} />
      </Modal>
    </RideSheet>
  );
}

/** TRIP_COMPLETED / RIDE_CANCELLED (driver). */
export function DriverSummaryPanel({ ride, onCoverChange, bottomOffset }: CoverProps & { ride: Ride }) {
  const finish = useDriverStore((store) => store.finishSummary);
  const cancelled = ride.status === "CANCELLED";
  const duration =
    ride.timestamps.startedAt && ride.timestamps.completedAt
      ? (Date.parse(ride.timestamps.completedAt) - Date.parse(ride.timestamps.startedAt)) / 1000
      : ride.route.durationSeconds;

  return (
    <RideSheet
      label={cancelled ? "Trip cancelled" : "Trip complete"}
      collapsible={false}
      onCoverChange={onCoverChange}
      bottomOffset={bottomOffset}
      resetKey="driver-summary"
      peek={
        <div className="flex items-center gap-4 pt-1">
          <PinCharacter mood={cancelled ? "resting" : "happy"} size={50} />
          <div className="min-w-0">
            <h2 className="ride-heading-lg">
              {cancelled ? (ride.cancellation?.by === "driver" ? "You cancelled this trip" : "The rider cancelled") : "Trip complete"}
            </h2>
            <p className="ride-body-sm text-[var(--text-secondary)]">
              {cancelled ? "You're free for the next request." : `Dropped off at ${ride.destination.name}`}
            </p>
          </div>
        </div>
      }
      footer={
        <Button size="xl" block pill onClick={finish}>
          {cancelled ? "Back to waiting" : "Done"}
        </Button>
      }
    >
      {!cancelled ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pb-3">
          <div className="flex items-baseline justify-between rounded-[var(--ride-radius-lg)] bg-[var(--ride-brand-soft)] px-4 py-4">
            <p className="ride-body font-semibold">You earned</p>
            <p className="ride-num text-[2rem] leading-none font-semibold tracking-[-0.04em]">{formatMoney(ride.driverEarning ?? ride.fare.total)}</p>
          </div>
          <MetricRow
            items={[
              { label: "Distance", value: formatDistance(ride.route.distanceMeters) },
              { label: "Time", value: formatDuration(duration) },
              { label: "Fare", value: formatMoney(ride.fare.total) },
            ]}
          />
          <p className="ride-caption">The rider can rate this trip for a short while; ratings appear in Trips.</p>
        </motion.div>
      ) : null}
    </RideSheet>
  );
}
