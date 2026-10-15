"use client";

import { TransportModeSwitch } from "@/components/layout/transport-mode-switch";

/** Shared service selector, also used by the Free Buses member header. */
export function RideModeSwitch() {
  return <TransportModeSwitch active="rides" />;
}
