"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { PASSENGER_NAV } from "@/constants/navigation";
import { queryKeys } from "@/constants/query-keys";
import { userService } from "@/services";
import { MembershipStatus } from "@/types/enums";
import { useSessionStore } from "@/stores/session-store";
import { shortName } from "@/lib/format";

/** Routes whose map fills the viewport and supplies its own padding. */
const BLEED_ROUTES = ["/passenger/matching", "/passenger/trip"];

export function PassengerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bleed = BLEED_ROUTES.some((route) => pathname.startsWith(route));

  const { data: passenger } = useQuery({
    queryKey: queryKeys.passenger.profile(),
    queryFn: () => userService.getCurrentPassenger(),
  });

  const activeRideId = useSessionStore((state) => state.activeRideId);

  return (
    <AppShell
      nav={PASSENGER_NAV}
      user={{
        name: passenger ? shortName(passenger.fullName) : "Member",
        avatarUrl: passenger?.avatarUrl,
        roleLabel:
          passenger?.membershipStatus === MembershipStatus.VERIFIED
            ? "Verified Member"
            : "Member",
        profileHref: "/passenger/profile",
        verified: passenger?.membershipStatus === MembershipStatus.VERIFIED,
      }}
      railStatus={
        activeRideId
          ? { label: "Ride in progress", tone: "active", live: true }
          : undefined
      }
      bleed={bleed}
    >
      {children}
    </AppShell>
  );
}
