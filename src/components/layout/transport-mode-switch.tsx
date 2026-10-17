"use client";

import Link from "next/link";
import { BusFront, CarFront } from "lucide-react";
import { PAID_RIDES_ENABLED } from "@/features/paid-rides/config";

export function TransportModeSwitch({ active = "buses", ridesHref = "/rides" }: { active?: "buses" | "rides"; ridesHref?: string }) {
  return (
    <nav aria-label="Transport mode" className="transport-mode-switch">
      <Link href="/passenger/free-buses" aria-current={active === "buses" ? "page" : undefined}>
        <BusFront aria-hidden className="size-4" /><span>Free buses</span>
      </Link>
      {PAID_RIDES_ENABLED ? (
        <Link href={ridesHref} aria-current={active === "rides" ? "page" : undefined}>
          <CarFront aria-hidden className="size-4" /><span>Paid rides</span>
        </Link>
      ) : (
        <span aria-disabled="true" title="Paid rides are not enabled on this deployment">
          <CarFront aria-hidden className="size-4" /><span>Paid rides</span>
        </span>
      )}
    </nav>
  );
}
