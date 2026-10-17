"use client";

import { TransportModeSwitch } from "@/components/layout/transport-mode-switch";
import { usePathname } from "next/navigation";

/** Shared service selector, also used by the Free Buses member header. */
export function RideModeSwitch() {
  const pathname = usePathname();
  return <TransportModeSwitch active="rides" ridesHref={pathname.startsWith("/rides/driver") ? "/rides/driver" : "/rides"} />;
}
