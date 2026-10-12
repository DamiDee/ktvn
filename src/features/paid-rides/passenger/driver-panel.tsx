"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle, Phone, Share2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { firstName, formatDistance } from "../domain/format";
import type { PassengerPhase } from "../domain/phases";
import { passengerCanCancel } from "../domain/ride-status";
import type { Ride } from "../domain/types";
import { ActionTile } from "../components/action-tile";
import { PinCharacter } from "../components/characters";
import { RideSheet } from "../components/ride-sheet";
import { DriverIdentity, EtaValue, RouteStops, SharedRideNote } from "../components/ride-ui";
import { PipPromptCard } from "../pip/floating-tracker";
import { SafetyCenter } from "../safety/safety-center";
import { shareTrip } from "../safety/share-trip";
import { usePassengerStore } from "../state/passenger-store";
import type { SheetHostProps } from "./panel-types";

/**
 * DRIVER_MATCHED → EN_ROUTE → ARRIVING → ARRIVED.
 *
 * One sheet, four moods. The ETA is the hero while the driver approaches;
 * at arrival the hero becomes "where to meet". Identity (photo, car, colour,
 * plate) is always visible before boarding.
 */
export function DriverPanel({ ride, phase, onCoverChange, bottomOffset }: SheetHostProps & { ride: Ride; phase: PassengerPhase }) {
  const unread = usePassengerStore((store) => store.session.unread);
  const sosAcknowledged = usePassengerStore((store) => store.session.sosAcknowledged);
  const cancelRide = usePassengerStore((store) => store.cancelRide);
  const pending = usePassengerStore((store) => store.session.pending);
  const { toast } = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const driver = ride.driver;
  if (!driver) return null;

  const name = firstName(driver.displayName);
  const arrived = phase === "DRIVER_ARRIVED";
  const arriving = phase === "DRIVER_ARRIVING";
  const eta = ride.approach?.etaSeconds ?? null;
  const distance = ride.approach?.distanceMeters ?? null;

  const headline = arrived
    ? `${name} has arrived`
    : arriving
      ? `${name} is arriving`
      : phase === "DRIVER_MATCHED"
        ? `${name} is on the way`
        : `${name} arrives in`;

  async function onShare() {
    const outcome = await shareTrip(ride);
    if (outcome === "copied") toast({ title: "Trip link copied", tone: "success" });
    if (outcome === "failed") toast({ title: "Couldn't share from this browser", tone: "warning" });
  }

  return (
    <RideSheet
      label="Your driver"
      onCoverChange={onCoverChange}
      bottomOffset={bottomOffset}
      resetKey={arrived ? "arrived" : "approach"}
      maxHeight="58dvh"
      peek={
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={headline}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className={cn("ride-heading-md", arrived && "text-[var(--ride-success)]")}
              >
                {headline}
              </motion.p>
            </AnimatePresence>
            <p className="ride-body-sm truncate text-[var(--text-secondary)]">
              {arrived
                ? `Meet at ${ride.pickup.name}`
                : distance !== null
                  ? `${formatDistance(distance)} away · ${driver.vehicle.color} ${driver.vehicle.model}`
                  : `${driver.vehicle.color} ${driver.vehicle.model}`}
            </p>
          </div>
          {arrived ? (
            <PinCharacter mood="found" size={44} />
          ) : eta !== null && phase !== "DRIVER_MATCHED" ? (
            <motion.div
              animate={arriving ? { scale: [1, 1.06, 1] } : { scale: 1 }}
              transition={arriving ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
              className={cn("rounded-[var(--ride-radius-md)] px-3 py-2 text-center", arriving ? "bg-[var(--ride-primary)] text-[var(--ride-on-primary)]" : "bg-[var(--surface-secondary)]")}
            >
              <EtaValue seconds={eta} size="lg" className={arriving ? "[&_span]:text-[var(--ride-on-primary)]" : undefined} />
            </motion.div>
          ) : (
            <PinCharacter mood="found" size={44} />
          )}
        </div>
      }
    >
      <div className="space-y-5 pb-3">
        {ride.tripPin ? (
          <div className="flex items-center justify-between rounded-[var(--ride-radius-md)] bg-[var(--ride-brand-soft)] px-4 py-3">
            <p className="ride-body-sm font-medium">Share this PIN with your driver</p>
            <p className="ride-num text-[1.5rem] font-bold tracking-[0.2em]">{ride.tripPin}</p>
          </div>
        ) : null}

        <DriverIdentity driver={driver} emphasis={arrived ? "arrived" : "default"} />

        <div className="flex gap-2">
          {driver.contact.call !== "none" && driver.contact.callHref ? (
            <ActionTile icon={Phone} label="Call" href={driver.contact.callHref} />
          ) : null}
          {driver.contact.chat ? <ActionTile icon={MessageCircle} label="Message" href={`/rides/${ride.id}/chat`} badge={unread} /> : null}
          <ActionTile icon={ShieldCheck} label="Safety" tone="safety" onClick={() => setSafetyOpen(true)} />
          <ActionTile icon={Share2} label="Share" onClick={() => void onShare()} />
        </div>

        {ride.shared ? <SharedRideNote shared={ride.shared} /> : null}

        <RouteStops pickup={ride.pickup} destination={ride.destination} />

        <PipPromptCard />

        {passengerCanCancel(ride.status) ? (
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            disabled={pending === "cancel"}
            className="ride-press w-full rounded-full py-3 text-[0.9375rem] font-semibold text-[var(--ride-danger)] disabled:opacity-50"
          >
            {pending === "cancel" ? "Cancelling…" : "Cancel ride"}
          </button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          void cancelRide("rider_cancelled_after_match");
        }}
        title={`Cancel your ride with ${name}?`}
        description={arrived ? "Your driver is already waiting for you. A cancellation fee may apply." : "Your driver is on the way. A small fee may apply if they've travelled a while."}
        confirmLabel="Cancel ride"
        cancelLabel="Keep my ride"
        tone="danger"
      />
      <Modal open={safetyOpen} onClose={() => setSafetyOpen(false)} title="Safety" size="sm">
        <SafetyCenter ride={ride} role="passenger" sosAcknowledged={sosAcknowledged} />
      </Modal>
    </RideSheet>
  );
}
