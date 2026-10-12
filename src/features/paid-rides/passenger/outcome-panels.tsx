"use client";

import { Button } from "@/components/ui/button";
import { firstName } from "../domain/format";
import type { Ride } from "../domain/types";
import { PinCharacter } from "../components/characters";
import { RideSheet } from "../components/ride-sheet";
import { RouteStops } from "../components/ride-ui";
import { usePassengerStore } from "../state/passenger-store";
import type { SheetHostProps } from "./panel-types";

/** Put the finished ride's route back into the booking draft. */
function useRebook(ride: Ride) {
  const dismissRide = usePassengerStore((store) => store.dismissRide);
  const setDraft = usePassengerStore((store) => store.setDraft);
  return () => {
    dismissRide();
    setDraft({ pickup: ride.pickup, destination: ride.destination, optionId: null, step: "options" });
  };
}

/** NO_DRIVERS_AVAILABLE: say so plainly, offer the two useful next steps. */
export function NoDriversPanel({ ride, onCoverChange, bottomOffset }: SheetHostProps & { ride: Ride }) {
  const retrySearch = usePassengerStore((store) => store.retrySearch);
  const pending = usePassengerStore((store) => store.session.pending);
  const rebook = useRebook(ride);

  return (
    <RideSheet
      label="No drivers available"
      collapsible={false}
      onCoverChange={onCoverChange}
      bottomOffset={bottomOffset}
      resetKey="no-drivers"
      peek={
        <div className="flex flex-col items-center pt-2 text-center">
          <PinCharacter mood="confused" size={60} />
          <h2 className="ride-heading-lg mt-3">No drivers are nearby right now</h2>
          <p className="ride-body-sm mt-1 max-w-xs text-[var(--text-secondary)]">
            Every {ride.option.name} driver near your pickup is busy. You haven&apos;t been charged.
          </p>
        </div>
      }
      footer={
        <div className="grid gap-2">
          <Button size="xl" block pill loading={pending === "request"} loadingLabel="Searching" onClick={() => void retrySearch(null)}>
            Try again
          </Button>
          <Button variant="subtle" size="lg" block pill onClick={rebook}>
            Change ride type
          </Button>
        </div>
      }
    />
  );
}

/** CANCELLED_*: who cancelled, what it means for the rider, what to do next. */
export function CancelledPanel({ ride, onCoverChange, bottomOffset }: SheetHostProps & { ride: Ride }) {
  const dismissRide = usePassengerStore((store) => store.dismissRide);
  const rebook = useRebook(ride);
  const by = ride.cancellation?.by ?? "passenger";
  const driverName = ride.driver ? firstName(ride.driver.displayName) : "Your driver";

  const copy =
    by === "driver"
      ? { title: `${driverName} had to cancel`, body: "Sorry about that. You won't be charged, and we can find you another driver now.", action: "Find another driver" }
      : by === "system"
        ? { title: "This ride was cancelled", body: ride.cancellation?.reason ?? "We couldn't complete this booking. You haven't been charged.", action: "Book again" }
        : { title: "Ride cancelled", body: ride.cancellation?.fee ? "A cancellation fee applies because your driver was already on the way." : "You haven't been charged.", action: "Book again" };

  return (
    <RideSheet
      label="Ride cancelled"
      collapsible={false}
      onCoverChange={onCoverChange}
      bottomOffset={bottomOffset}
      resetKey="cancelled"
      peek={
        <div className="pt-2">
          <h2 className="ride-heading-lg">{copy.title}</h2>
          <p className="ride-body-sm mt-1 text-[var(--text-secondary)]">{copy.body}</p>
        </div>
      }
      footer={
        <div className="grid gap-2">
          <Button size="xl" block pill onClick={rebook}>
            {copy.action}
          </Button>
          <Button variant="ghost" size="lg" block pill onClick={dismissRide}>
            Done
          </Button>
        </div>
      }
    >
      <div className="pb-2">
        <RouteStops pickup={ride.pickup} destination={ride.destination} compact />
      </div>
    </RideSheet>
  );
}
