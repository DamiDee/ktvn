"use client";

import { useCurrentDriver } from "./use-current-driver";
import { DriverTrack } from "@/types/enums";
import { PageLoader } from "@/components/ui/route-loader";
import { VolunteerDashboard } from "./volunteer-dashboard";
import { ProfessionalDashboard } from "./professional-dashboard";

/**
 * The driver's home screen differs by track — service-oriented for
 * volunteers, operational for professionals. One route, two experiences.
 */
export function DriverHome() {
  const { data: driver, isLoading } = useCurrentDriver();

  if (isLoading || !driver) {
    return <PageLoader message="Preparing your dashboard" />;
  }

  return driver.track === DriverTrack.VOLUNTEER ? (
    <VolunteerDashboard driver={driver} />
  ) : (
    <ProfessionalDashboard driver={driver} />
  );
}
