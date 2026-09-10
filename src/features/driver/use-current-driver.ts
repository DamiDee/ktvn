"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import { userService } from "@/services";
import { useSessionStore } from "@/stores/session-store";

/**
 * The signed-in driver.
 *
 * One hook rather than a `useQuery` in each screen, so the active driver
 * (volunteer or professional) is resolved the same way everywhere and the
 * cache key never drifts between callers.
 */
export function useCurrentDriver() {
  const driverId = useSessionStore((state) => state.activeDriverId);

  return useQuery({
    queryKey: queryKeys.driver.profile(driverId ?? undefined),
    queryFn: () => userService.getCurrentDriver(driverId ?? undefined),
  });
}
