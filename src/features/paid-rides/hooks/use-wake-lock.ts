"use client";

import { useEffect, useState } from "react";
import { maintainScreenWakeLock, type ScreenWakeStatus } from "./screen-wake-lock";

/**
 * Keeps the screen on for the lifetime of an online session or active trip.
 * Reports denial/unsupported devices and reacquires after visibility changes.
 */
export function useWakeLock(active: boolean): ScreenWakeStatus {
  const [status, setStatus] = useState<ScreenWakeStatus>("inactive");
  useEffect(() => {
    if (!active) return;
    return maintainScreenWakeLock(document, window, navigator.wakeLock, setStatus);
  }, [active]);
  return active ? status : "inactive";
}
