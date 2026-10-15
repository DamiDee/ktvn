"use client";

import { useState } from "react";
import { MessageCircle, Share2, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { firstName, formatArrivalClock, splitDistance } from "../domain/format";
import type { Ride } from "../domain/types";
import { ActionTile } from "../components/action-tile";
import { RideSheet } from "../components/ride-sheet";
import { BigValue, EtaValue, PersonAvatar, PlateBadge, SharedRideNote } from "../components/ride-ui";
import { PipPromptCard } from "../pip/floating-tracker";
import { SafetyCenter } from "../safety/safety-center";
import { shareTrip } from "../safety/share-trip";
import { usePassengerStore } from "../state/passenger-store";
import type { SheetHostProps } from "./panel-types";
import { PAID_RIDES_FEATURES } from "../config";

/**
 * TRIP_ACTIVE: map first, then destination, ETA, remaining distance, safety,
 * driver, messages — in that order, and nothing else.
 */
export function TripPanel({ ride, paused, onCoverChange, bottomOffset }: SheetHostProps & { ride: Ride; paused: boolean }) {
  const unread = usePassengerStore((store) => store.session.unread);
  const sosAcknowledged = usePassengerStore((store) => store.session.sosAcknowledged);
  const { toast } = useToast();
  const [safetyOpen, setSafetyOpen] = useState(false);
  const eta = ride.progress?.etaSeconds ?? ride.route.durationSeconds;
  const remaining = ride.progress?.remainingMeters ?? ride.route.distanceMeters;
  const progress = ride.route.distanceMeters > 0 ? 1 - remaining / ride.route.distanceMeters : 0;

  async function onShare() {
    const outcome = await shareTrip(ride);
    if (outcome === "copied") toast({ title: "Trip details copied", tone: "success" });
    if (outcome === "failed") toast({ title: "Couldn't share from this browser", tone: "warning" });
  }

  return (
    <RideSheet
      label="Your trip"
      onCoverChange={onCoverChange}
      bottomOffset={bottomOffset}
      resetKey="trip"
      maxHeight="52dvh"
      peek={
        <div>
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="ride-caption">{paused ? "Trip paused" : "Heading to"}</p>
              <p className="ride-heading-md truncate">{ride.destination.name}</p>
            </div>
            <div className="shrink-0 text-right">
              <EtaValue seconds={eta} size="lg" />
              <p className="ride-caption ride-num">Arrive {formatArrivalClock(eta)}</p>
            </div>
          </div>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]"
            role="progressbar"
            aria-label="Trip progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div className="h-full rounded-full bg-[var(--ride-primary)] transition-[width] duration-1000 ease-linear" style={{ width: `${Math.max(3, progress * 100)}%` }} />
          </div>
          <p className="ride-caption mt-1.5 flex justify-between">
            <span>
              <BigValue value={splitDistance(remaining)} size="md" className="[&>span:first-child]:text-[0.9375rem]" /> left
            </span>
            {ride.route.source === "approximate" ? <span>Approximate route</span> : null}
          </p>
        </div>
      }
    >
      <div className="space-y-5 pb-3">
        <div className="flex gap-2">
          <ActionTile icon={ShieldCheck} label="Safety" tone="safety" onClick={() => setSafetyOpen(true)} />
          <ActionTile icon={Share2} label="Share trip" onClick={() => void onShare()} />
          {ride.driver?.contact.chat && PAID_RIDES_FEATURES.chat ? <ActionTile icon={MessageCircle} label="Message" href={`/rides/${ride.id}/chat`} badge={unread} /> : null}
        </div>

        {ride.driver ? (
          <div className="flex items-center gap-3 rounded-[var(--ride-radius-md)] bg-[var(--surface-secondary)] p-3">
            <PersonAvatar name={ride.driver.displayName} src={ride.driver.avatarUrl} size={40} />
            <div className="min-w-0 flex-1">
              <p className="ride-body font-semibold">{firstName(ride.driver.displayName)}</p>
              <p className="ride-caption truncate">
                {ride.driver.vehicle.color} {ride.driver.vehicle.make} {ride.driver.vehicle.model}
              </p>
            </div>
            <PlateBadge plate={ride.driver.vehicle.plate} />
          </div>
        ) : null}

        {ride.shared ? <SharedRideNote shared={ride.shared} /> : null}

        <PipPromptCard />
      </div>
      <Modal open={safetyOpen} onClose={() => setSafetyOpen(false)} title="Safety" size="sm">
        <SafetyCenter ride={ride} role="passenger" sosAcknowledged={sosAcknowledged} />
      </Modal>
    </RideSheet>
  );
}
