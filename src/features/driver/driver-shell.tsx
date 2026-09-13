"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
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

/** Routes whose map fills the viewport and supplies its own padding. */
const BLEED_ROUTES = ["/driver/trip", "/driver/waiting"];

export function DriverShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bleed = BLEED_ROUTES.some((route) => pathname.startsWith(route));

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
      bleed={bleed}
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
      {/* Driver screens run a notch tighter than the rest of the product. */}
      <div className={bleed ? "kx-compact h-full min-h-0" : "kx-compact"}>
        {children}
      </div>
    </AppShell>
  );
}
