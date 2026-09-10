"use client";

import { useCurrentDriver } from "./use-current-driver";
import { PageLoader } from "@/components/ui/route-loader";
import { TrackSwitch } from "./track-switch";

export function TrackSwitchPage() {
  const { data: driver, isLoading } = useCurrentDriver();

  if (isLoading || !driver) return <PageLoader message="Loading your track" />;

  return <TrackSwitch driver={driver} />;
}
