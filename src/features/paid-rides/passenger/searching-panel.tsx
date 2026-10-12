"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { PAID_RIDES_CONFIG } from "../config";
import { formatDistance } from "../domain/format";
import type { Ride } from "../domain/types";
import { SearchBeacon } from "../components/characters";
import { RideSheet } from "../components/ride-sheet";
import { FareAmount, VehicleIllustration } from "../components/ride-ui";
import { usePassengerStore } from "../state/passenger-store";
import type { SheetHostProps } from "./panel-types";

const STATUS_LINES = [
  "Contacting drivers near your pickup",
  `Looking within about ${formatDistance(PAID_RIDES_CONFIG.searchRadiusMeters)}`,
  "Matching you with the best-placed driver",
];
const SHOW_ELAPSED_AFTER_S = 25;

/** REQUESTING / SEARCHING: alive, calm, and always cancellable. */
export function SearchingPanel({ ride, onCoverChange, bottomOffset }: SheetHostProps & { ride: Ride | null }) {
  const draft = usePassengerStore((store) => store.draft);
  const cancelRide = usePassengerStore((store) => store.cancelRide);
  const pending = usePassengerStore((store) => store.session.pending);
  const [confirming, setConfirming] = useState(false);
  const [line, setLine] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setLine((value) => (value + 1) % STATUS_LINES.length), 3200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ride) return;
    const started = Date.parse(ride.createdAt);
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - started) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [ride]);

  const optionName = ride?.option.name ?? "your ride";
  const destinationName = ride?.destination.name ?? draft.destination?.name;

  return (
    <RideSheet
      label="Finding a driver"
      onCoverChange={onCoverChange}
      bottomOffset={bottomOffset}
      resetKey="searching"
      peek={
        <div className="flex flex-col items-center pt-1 text-center">
          <SearchBeacon mood="searching" />
          <h2 className="ride-heading-lg mt-1">{ride ? "Finding your driver" : "Sending your request"}</h2>
          <div className="relative mt-1 h-5 w-full overflow-hidden" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.p
                key={ride ? line : "sending"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="ride-body-sm text-[var(--text-secondary)]"
              >
                {ride ? STATUS_LINES[line] : "Confirming your fare and pickup"}
              </motion.p>
            </AnimatePresence>
          </div>
          {elapsed >= SHOW_ELAPSED_AFTER_S ? (
            <p className="ride-caption ride-num mt-1">Searching for {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} · busier than usual</p>
          ) : null}
        </div>
      }
      footer={
        <Button variant="subtle" size="lg" block pill disabled={!ride} loading={pending === "cancel"} loadingLabel="Cancelling" onClick={() => setConfirming(true)}>
          Cancel request
        </Button>
      }
    >
      {ride ? (
        <div className="flex items-center gap-3.5 rounded-[var(--ride-radius-md)] bg-[var(--surface-secondary)] p-3.5">
          <VehicleIllustration vehicleClass={ride.option.vehicleClass} className="h-8 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="ride-body font-semibold">{optionName}</p>
            <p className="ride-caption truncate">To {destinationName}</p>
          </div>
          <FareAmount fare={ride.fare} emphasis="sm" />
        </div>
      ) : (
        <div className="kx-skeleton h-16 w-full rounded-[var(--ride-radius-md)]" aria-hidden />
      )}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void cancelRide("rider_cancelled_while_searching");
        }}
        title="Cancel this request?"
        description="No driver has been assigned yet, so there's no charge."
        confirmLabel="Cancel request"
        cancelLabel="Keep searching"
        tone="danger"
      />
    </RideSheet>
  );
}
