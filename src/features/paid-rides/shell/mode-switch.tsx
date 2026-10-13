"use client";

import Link from "next/link";
import { BusFront, CarFront } from "lucide-react";

/**
 * Free Buses ⇄ Paid Rides. Paid Rides is a separate shell at /rides, so this
 * floating switch is the way back to the bus service (and mirrors the
 * "Paid rides" entry in the Free Buses navigation).
 */
export function RideModeSwitch() {
  return (
    <nav
      aria-label="Transport mode"
      className="pointer-events-auto flex gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-glass)] p-1 shadow-[var(--ride-elev-1)] backdrop-blur-xl"
    >
      <Link
        href="/passenger/free-buses"
        className="ride-press flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <BusFront className="size-4" aria-hidden />
        Free buses
      </Link>
      <span
        aria-current="page"
        className="flex h-9 items-center gap-1.5 rounded-full bg-[var(--surface-primary)] px-3.5 text-[0.8125rem] font-semibold text-[var(--text-primary)] shadow-[var(--kx-shadow-sm)]"
      >
        <CarFront className="size-4" aria-hidden />
        Paid rides
      </span>
    </nav>
  );
}
