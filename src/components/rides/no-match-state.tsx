"use client";

import { Compass, MapPin, RefreshCw, User, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { RouteMedallion } from "@/components/ui/route-medallion";
import { DriverTrack, RideType } from "@/types/enums";

export interface NoMatchActions {
  onSearchAgain: () => void;
  onTryProfessional?: () => void;
  onChangeDestination: () => void;
  onChoosePrivate?: () => void;
}

/**
 * No driver available.
 *
 * Calm, not an error page — and only the options that actually apply to the
 * current request are offered. A passenger already on the professional track
 * is never told to "try professional"; a private ride is never told to choose
 * private.
 */
export function NoMatchState({
  track,
  rideType,
  destinationLabel,
  actions,
  className,
}: {
  track: DriverTrack;
  rideType: RideType;
  destinationLabel?: string;
  actions: NoMatchActions;
  className?: string;
}) {
  const canOfferProfessional =
    track === DriverTrack.VOLUNTEER && Boolean(actions.onTryProfessional);
  const canOfferPrivate =
    rideType === RideType.SHARED && Boolean(actions.onChoosePrivate);

  return (
    <div className={cn("text-center", className)}>
      <div className="flex justify-center">
        <RouteMedallion icon={Compass} />
      </div>

      <h2 className="type-section-title mt-5 text-ink">
        No matching driver is available right now.
      </h2>
      <p className="type-body mx-auto mt-2.5 max-w-md text-ink-secondary">
        {destinationLabel
          ? `No one is heading toward ${destinationLabel} at the moment. A few things you could try:`
          : "No one is heading your way at the moment. A few things you could try:"}
      </p>

      <div className="mx-auto mt-7 flex max-w-sm flex-col gap-2.5">
        <Button
          variant="primary"
          size="lg"
          block
          icon={RefreshCw}
          onClick={actions.onSearchAgain}
        >
          Search Again
        </Button>

        {canOfferProfessional ? (
          <Button
            variant="secondary"
            size="lg"
            block
            icon={Wallet}
            onClick={actions.onTryProfessional}
          >
            Try Professional
          </Button>
        ) : null}

        {canOfferPrivate ? (
          <Button
            variant="secondary"
            size="lg"
            block
            icon={User}
            onClick={actions.onChoosePrivate}
          >
            Choose Private Ride
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="lg"
          block
          icon={MapPin}
          onClick={actions.onChangeDestination}
        >
          Change Destination
        </Button>
      </div>

      <p className="type-meta mx-auto mt-6 max-w-sm text-ink-muted">
        Drivers become available as members finish service, so it&rsquo;s often
        worth trying again in a few minutes.
      </p>
    </div>
  );
}
