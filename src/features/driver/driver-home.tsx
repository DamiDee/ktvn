"use client";

import { useCurrentDriver } from "./use-current-driver";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { DriverAccountStatus, DriverTrack } from "@/types/enums";
import { PageLoader } from "@/components/ui/route-loader";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { InspectionCountdownCard } from "@/components/drivers/inspection-countdown-card";
import { useSessionStore } from "@/stores/session-store";
import { VolunteerDashboard } from "./volunteer-dashboard";
import { ProfessionalDashboard } from "./professional-dashboard";

/**
 * The driver's home screen differs by track — service-oriented for
 * volunteers, operational for professionals. One route, two experiences.
 */
export function DriverHome() {
  const { data: driver, isLoading } = useCurrentDriver();
  const activeTrack = useSessionStore((state) => state.driverTrack);

  if (isLoading || !driver) {
    return <PageLoader message="Preparing your dashboard" />;
  }

  if (driver.accountStatus === DriverAccountStatus.DEACTIVATED) {
    return (
      <div className="mx-auto max-w-2xl py-8 sm:py-14">
        <Card radius="2xl" className="border-danger-500/30">
          <span className="grid size-12 place-items-center rounded-full bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-red-300">
            <AlertTriangle className="size-6" aria-hidden />
          </span>
          <p className="type-micro mt-6 text-danger-600 dark:text-red-300">
            Driving access paused
          </p>
          <h1 className="type-page-title mt-2 text-ink">Your account is deactivated.</h1>
          <p className="type-body mt-3 text-ink-secondary">
            {driver.deactivationReason ??
              "Your account needs an inspection review before you can go online again."}
          </p>
          <div className="mt-6">
            <InspectionCountdownCard inspection={driver.inspection} />
          </div>
          <ButtonLink
            href="mailto:inspection@k-rides.example"
            variant="primary"
            size="lg"
            className="mt-6"
            icon={CalendarClock}
          >
            Contact inspection desk
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const track = driver.eligibleTracks?.includes(activeTrack)
    ? activeTrack
    : driver.track;

  return track === DriverTrack.VOLUNTEER ? (
    <VolunteerDashboard driver={driver} />
  ) : (
    <ProfessionalDashboard driver={driver} />
  );
}
