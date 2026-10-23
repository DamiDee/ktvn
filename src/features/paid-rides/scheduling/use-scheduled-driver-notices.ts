"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { accountSession } from "@/lib/account-session";
import { useToast } from "@/components/ui/toast";
import { PAID_RIDES_MODE } from "../config";
import { getRealtimeClient } from "../realtime";

/** Driver mailbox hints share the ride socket even when the board is closed. */
export function useScheduledDriverNotices(driverId: string | undefined) {
  const queries = useQueryClient(), router = useRouter(), pathname = usePathname();
  const { toast } = useToast();
  useEffect(() => {
    if (!driverId || PAID_RIDES_MODE !== "api" || accountSession.isBlocked()) return;
    const scope = accountSession.capture();
    return getRealtimeClient().onScheduledEvent((event) => {
      if (!scope.isCurrent()) return;
      void queries.invalidateQueries({ queryKey: ["paid-rides", "schedules", driverId] });
      if (pathname === "/rides/driver/schedule" || !["scheduled.opened", "scheduled.reopened", "scheduled.matching_reminder"].includes(event.type)) return;
      // An older broadcast can arrive with a newer, already-reserved snapshot.
      if (event.booking && event.booking.status !== "OPEN") return;
      toast({ title: "Scheduled trip request", description: "Review upcoming journeys and accept a trip you can serve.", durationMs: 8000,
        action: { label: "View requests", onClick: () => router.push("/rides/driver/schedule") },
      });
    });
  }, [driverId, pathname, queries, router, toast]);
}
