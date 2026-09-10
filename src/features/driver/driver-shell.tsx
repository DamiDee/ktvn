"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { driverNavForTrack } from "@/constants/navigation";
import { useCurrentDriver } from "./use-current-driver";
import {
  DriverAvailability,
  DriverTrack,
  VerificationStatus,
} from "@/types/enums";
import {
  DRIVER_AVAILABILITY_PRESENTATION,
  TRACK_LABEL,
} from "@/constants/status-presentation";
import { isDriverOnline } from "@/lib/state-machines";
import { shortName } from "@/lib/format";

export function DriverShell({ children }: { children: ReactNode }) {
  const { data: driver } = useCurrentDriver();

  // The shell renders before the driver resolves, so every field falls back —
  // the navigation must never disappear mid-load.
  const track = driver?.track ?? DriverTrack.VOLUNTEER;
  const availability = driver?.availability ?? DriverAvailability.OFFLINE;
  const presentation = DRIVER_AVAILABILITY_PRESENTATION[availability];

  return (
    <AppShell
      nav={driverNavForTrack(track)}
      user={{
        name: driver ? shortName(driver.fullName) : "Driver",
        avatarUrl: driver?.avatarUrl,
        roleLabel: `${TRACK_LABEL[track]} Driver`,
        profileHref: "/driver/profile",
        verified: driver?.verificationStatus === VerificationStatus.APPROVED,
      }}
      railStatus={{
        label: presentation.label,
        tone:
          presentation.tone === "active"
            ? "active"
            : presentation.tone === "pending"
              ? "pending"
              : "neutral",
        live: isDriverOnline(availability),
      }}
    >
      {children}
    </AppShell>
  );
}
