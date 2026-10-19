"use client";

import { SosBanner } from "@/components/safety/sos-banner";
import { isSosLive } from "@/lib/state-machines";
import { DriverTrack } from "@/types/enums";
import { useActiveSos, useAdminLiveUpdates } from "./data/use-admin-live";

/**
 * Shared by both admin shells: keeps the workspace current and shows the
 * newest open SOS on every Paid Rides admin page.
 */
export function AdminLiveLayer({ className = "mb-6" }: { className?: string }) {
  useAdminLiveUpdates();
  const { data: sos } = useActiveSos();
  return sos && isSosLive(sos.status) ? <SosBanner alert={sos} track={DriverTrack.PROFESSIONAL} className={className} /> : null;
}
