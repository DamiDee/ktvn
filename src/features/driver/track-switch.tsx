"use client";

import { CheckCircle2, HandHeart, Wallet } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/app-shell";
import { DriverOnlineControl } from "@/components/drivers/driver-online-control";
import { DriverTrack } from "@/types/enums";
import type { Driver } from "@/types/models";

/** Approved tracks and the active-session selector. */
export function TrackSwitch({ driver }: { driver: Driver }) {
  const tracks = driver.eligibleTracks?.length
    ? driver.eligibleTracks
    : [driver.track];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Driving modes"
        title="Your approved tracks"
        description="Your approval can cover both tracks. Choose the one you want each time you go online."
      />

      <div className="space-y-5">
        <DriverOnlineControl driver={driver} />

        <Card radius="xl">
          <CardHeader
            title="Available to you"
            description="Going online on one track never removes your approval for the other."
            action={
              <StatusChip tone="success" icon={CheckCircle2}>
                {tracks.length} approved
              </StatusChip>
            }
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {tracks.map((track) => {
              const volunteer = track === DriverTrack.VOLUNTEER;
              const Icon = volunteer ? HandHeart : Wallet;
              return (
                <div
                  key={track}
                  className="rounded-[var(--kx-radius-md)] border border-line bg-surface-nested p-4"
                >
                  <Icon
                    className="size-5 text-forest-700 dark:text-gold-300"
                    strokeWidth={1.8}
                    aria-hidden
                  />
                  <p className="type-card-title mt-3 text-ink">
                    {volunteer ? "Volunteer" : "Professional"}
                  </p>
                  <p className="type-meta mt-1 text-ink-secondary">
                    {volunteer
                      ? "Offer seats as service. No fare is charged or collected."
                      : "Accept paid journeys with the fare agreed upfront."}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
