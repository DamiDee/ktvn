"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Car, Check, MapPin, Users } from "lucide-react";
import { Card, CardHeader, NestedTile } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusChip } from "@/components/ui/badge";
import { SafetyNote } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/app-shell";
import { DestinationSearch } from "@/components/rides/destination-search";
import { SeatMap } from "@/components/rides/seat-map";
import { useCurrentDriver } from "./use-current-driver";
import { UPCOMING_EVENT } from "@/mocks/rides";
import { LOCATIONS } from "@/mocks/locations";
import { MAX_SHARED_PASSENGERS } from "@/types/enums";
import { formatDate, formatTime } from "@/lib/format";
import type { RideLocation } from "@/types/models";

type Seats = "1" | "2" | "3";

/**
 * Volunteer availability for the next service.
 *
 * Everything here is about the offer being made — destination, seats, timing.
 * No fare, no earnings, no currency: this is Track A.
 */
export function VolunteerConfirm() {
  const router = useRouter();
  const { toast } = useToast();

  const { data: driver } = useCurrentDriver();

  const [destination, setDestination] = useState<RideLocation | null>(
    LOCATIONS.gwarinpa,
  );
  const [seats, setSeats] = useState<Seats>("3");
  const [confirmed, setConfirmed] = useState(
    driver?.service?.nextEventConfirmed ?? false,
  );
  const [declining, setDeclining] = useState(false);

  const seatCount = Number(seats);

  function confirm() {
    setConfirmed(true);
    toast({
      title: "Availability confirmed",
      description: `Members heading to ${destination?.label ?? "your destination"} can now find you.`,
      tone: "success",
    });
    router.push("/driver");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Volunteer service"
        title="Are you available after tonight's service?"
        description="Let members know where you're heading and how many seats you can offer."
        action={
          confirmed ? (
            <StatusChip tone="success" dot size="md">
              Confirmed
            </StatusChip>
          ) : (
            <StatusChip tone="pending" dot size="md">
              Awaiting your reply
            </StatusChip>
          )
        }
      />

      <div className="space-y-5">
        {/* Event */}
        <Card radius="xl">
          <div className="flex items-start gap-3.5">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-500/14 text-gold-700 dark:text-gold-300">
              <CalendarClock className="size-5" strokeWidth={1.7} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="type-card-title text-ink">{UPCOMING_EVENT.name}</p>
              <p className="type-meta mt-1 text-ink-secondary">
                {UPCOMING_EVENT.venue}
              </p>
              <p className="type-meta mt-0.5 text-ink-muted">
                {formatDate(UPCOMING_EVENT.startsAt)} · ends{" "}
                {formatTime(UPCOMING_EVENT.endsAt)}
              </p>
            </div>
          </div>
        </Card>

        {/* Vehicle */}
        <Card radius="xl">
          <CardHeader
            title="Your vehicle"
            description="This is what passengers will look for."
          />
          <NestedTile className="mt-5 grid grid-cols-3 gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Car className="size-4 text-ink-muted" strokeWidth={1.7} aria-hidden />
                <p className="type-micro text-ink-muted">Vehicle</p>
              </div>
              <p className="type-meta mt-1.5 truncate font-semibold text-ink">
                {driver ? `${driver.vehicle.make} ${driver.vehicle.model}` : "—"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="type-micro text-ink-muted">Colour</p>
              <p className="type-meta mt-1.5 truncate font-semibold text-ink">
                {driver?.vehicle.colour ?? "—"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="type-micro text-ink-muted">Plate</p>
              <p className="type-numeric type-meta mt-1.5 truncate font-semibold text-ink">
                {driver?.vehicle.plateNumber ?? "—"}
              </p>
            </div>
          </NestedTile>
        </Card>

        {/* Destination */}
        <Card radius="xl">
          <CardHeader
            title="Where are you heading?"
            description="Members travelling the same way will be matched to you."
          />
          <div className="mt-5">
            <DestinationSearch
              value={destination}
              onSelect={setDestination}
              onClear={() => setDestination(null)}
              placeholder="Your destination after service"
            />
          </div>
        </Card>

        {/* Seats */}
        <Card radius="xl">
          <CardHeader
            title="How many seats can you offer?"
            description={`Up to ${MAX_SHARED_PASSENGERS} passengers can travel with you.`}
          />

          <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] sm:items-start">
            <div>
              <SegmentedControl
                label="Available seats"
                size="lg"
                value={seats}
                onChange={setSeats}
                options={[
                  { value: "1", label: "1 seat" },
                  { value: "2", label: "2 seats" },
                  { value: "3", label: "3 seats" },
                ]}
              />
              <p className="type-meta mt-3 text-ink-secondary">
                {seatCount === MAX_SHARED_PASSENGERS
                  ? "You're offering every seat in the car."
                  : `You'll be matched with up to ${seatCount} ${seatCount === 1 ? "passenger" : "passengers"}.`}
              </p>

              <div className="mt-4 flex items-center gap-2">
                <Users className="size-4 text-ink-muted" strokeWidth={1.7} aria-hidden />
                <span className="type-meta text-ink-muted">
                  Seats fill as members request rides along your route.
                </span>
              </div>
            </div>

            <SeatMap
              occupants={[]}
              showSummary={false}
              className="max-w-[240px] sm:justify-self-end"
            />
          </div>
        </Card>

        <SafetyNote>
          Volunteer journeys are given in service — no fare is charged and no
          payment is collected. Passengers see your name, photo, vehicle and
          plate before they board.
        </SafetyNote>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button
            variant="primary"
            size="lg"
            icon={Check}
            className="sm:flex-[1.4]"
            disabled={!destination}
            onClick={confirm}
          >
            Confirm availability
          </Button>
          <Button
            variant="secondary"
            size="lg"
            icon={MapPin}
            className="sm:flex-1"
            onClick={() => router.push("/driver/destination")}
          >
            Set on map
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="sm:flex-1"
            onClick={() => setDeclining(true)}
          >
            Not available
          </Button>
        </div>

        {!destination ? (
          <p className="type-meta text-center text-ink-muted">
            Choose where you&rsquo;re heading to confirm.
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={declining}
        onClose={() => setDeclining(false)}
        onConfirm={() => {
          setConfirmed(false);
          setDeclining(false);
          toast({
            title: "Marked unavailable",
            description: "You won't receive requests for tonight's service.",
          });
          router.push("/driver");
        }}
        title="Not available tonight?"
        description="Members won't be matched to you for this service. You can change this any time before it starts."
        confirmLabel="I'm not available"
        cancelLabel="Go back"
      />
    </div>
  );
}
