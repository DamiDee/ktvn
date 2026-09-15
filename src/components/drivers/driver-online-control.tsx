"use client";

import { useState } from "react";
import { CircleDot, HandHeart, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusChip } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useSessionStore } from "@/stores/session-store";
import { DriverTrack } from "@/types/enums";
import type { Driver } from "@/types/models";

const trackLabel = {
  [DriverTrack.VOLUNTEER]: "Volunteer",
  [DriverTrack.PROFESSIONAL]: "Professional",
};

export function DriverOnlineControl({ driver }: { driver: Driver }) {
  const { toast } = useToast();
  const activeTrack = useSessionStore((state) => state.driverTrack);
  const online = useSessionStore((state) => state.driverOnline);
  const setActiveTrack = useSessionStore((state) => state.setDriverTrack);
  const setOnline = useSessionStore((state) => state.setDriverOnline);
  const eligibleTracks = driver.eligibleTracks?.length
    ? driver.eligibleTracks
    : [driver.track];
  const fallbackTrack = eligibleTracks.includes(activeTrack)
    ? activeTrack
    : eligibleTracks[0];
  const [chooserOpen, setChooserOpen] = useState(false);
  const [pendingTrack, setPendingTrack] = useState<DriverTrack>(fallbackTrack);

  function openChooser() {
    setPendingTrack(fallbackTrack);
    setChooserOpen(true);
  }

  function confirmOnline() {
    setActiveTrack(pendingTrack);
    setOnline(true);
    setChooserOpen(false);
    toast({
      title: `Online on the ${trackLabel[pendingTrack].toLowerCase()} track`,
      description: "You can now receive matching journey requests.",
      tone: "success",
    });
  }

  return (
    <>
      <Card radius="xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <span className="relative grid size-10 place-items-center rounded-full bg-surface-nested text-ink-muted">
              <CircleDot className="size-5" strokeWidth={1.8} aria-hidden />
              {online ? (
                <span className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-surface bg-success-500" />
              ) : null}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="type-section-title text-ink">
                  {online ? "You're online" : "You're offline"}
                </p>
                <StatusChip tone={online ? "success" : "neutral"} size="sm">
                  {trackLabel[fallbackTrack]}
                </StatusChip>
              </div>
              <p className="type-meta mt-1 text-ink-secondary">
                {online
                  ? `Receiving ${trackLabel[fallbackTrack].toLowerCase()} journey requests.`
                  : "Choose your operating track before members can find you."}
              </p>
            </div>
          </div>
          <Button
            variant={online ? "subtle" : "primary"}
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => {
              if (online) {
                setOnline(false);
                toast({
                  title: "You're offline",
                  description: "You won't receive new requests.",
                });
              } else {
                openChooser();
              }
            }}
          >
            {online ? "Go Offline" : "Choose Track & Go Online"}
          </Button>
        </div>
      </Card>

      <Modal
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        title="How are you driving today?"
        description="This only changes your active session. Both approved tracks remain available to you."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setChooserOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmOnline}>
              Go Online
            </Button>
          </>
        }
      >
        <SegmentedControl
          label="Active driving track"
          value={pendingTrack}
          onChange={setPendingTrack}
          size="lg"
          options={[
            {
              value: DriverTrack.VOLUNTEER,
              label: "Volunteer",
              icon: HandHeart,
              disabled: !eligibleTracks.includes(DriverTrack.VOLUNTEER),
            },
            {
              value: DriverTrack.PROFESSIONAL,
              label: "Professional",
              icon: Wallet,
              disabled: !eligibleTracks.includes(DriverTrack.PROFESSIONAL),
            },
          ]}
        />
        <p className="type-meta mt-4 text-ink-muted">
          Volunteer journeys never collect a fare. Professional journeys show
          the agreed fare before acceptance.
        </p>
      </Modal>
    </>
  );
}
