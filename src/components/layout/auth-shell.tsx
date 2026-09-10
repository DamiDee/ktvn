"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { MapCanvas } from "@/components/maps/map-canvas";
import { KoinoniaMark } from "@/components/ui/route-loader";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buildRoute } from "@/lib/geo";
import { LOCATIONS } from "@/mocks/locations";
import { useRideSimulation } from "@/features/rides/use-ride-simulation";
import { DriverTrack } from "@/types/enums";

const AUTH_ROUTE = buildRoute(LOCATIONS.koinoniaCentre, LOCATIONS.maitama, {
  seed: "auth-route",
  curvature: 0.22,
});

/**
 * Split-screen auth layout: an ambient animated map on the left, the form on
 * the right. On mobile the map collapses to a slim banner.
 */
export function AuthShell({
  children,
  trustStatement,
  eyebrow,
}: {
  children: ReactNode;
  trustStatement?: string;
  eyebrow?: string;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <AuthVisual trustStatement={trustStatement} eyebrow={eyebrow} />

      <main
        id="main"
        className="relative flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-14"
      >
        <div className="absolute top-5 right-5 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-md"
        >
          <Link
            href="/"
            className="kx-tap mb-8 inline-flex items-center gap-2.5 lg:hidden"
            aria-label="Koinonia VTN — home"
          >
            <KoinoniaMark className="size-6 text-forest-800 dark:text-gold-400" />
            <span className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-ink">
              Koinonia
              <span className="ml-1.5 font-normal text-ink-muted">VTN</span>
            </span>
          </Link>

          {children}
        </motion.div>
      </main>
    </div>
  );
}

function AuthVisual({
  trustStatement,
  eyebrow,
}: {
  trustStatement?: string;
  eyebrow?: string;
}) {
  const { progress, position, heading } = useRideSimulation({
    route: AUTH_ROUTE,
    durationSeconds: 34,
  });

  return (
    <aside className="relative hidden overflow-hidden bg-forest-900 lg:block">
      <MapCanvas
        className="absolute inset-0 size-full opacity-90"
        description="An ambient map showing a route across the city."
        routes={[
          {
            id: "auth",
            path: AUTH_ROUTE,
            variant: "primary",
            progress,
            animateDraw: true,
          },
        ]}
        markers={[
          { id: "pickup", position: LOCATIONS.koinoniaCentre, kind: "pickup" },
          { id: "destination", position: LOCATIONS.maitama, kind: "destination" },
          ...(position
            ? [
                {
                  id: "vehicle",
                  position,
                  kind: "vehicle" as const,
                  heading,
                  track: DriverTrack.PROFESSIONAL,
                },
              ]
            : []),
        ]}
      />

      {/* Legibility scrim */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-forest-950/92 via-forest-950/50 to-forest-950/25"
        aria-hidden
      />

      <div className="relative flex h-full flex-col justify-between p-10 xl:p-12">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2.5"
          aria-label="Koinonia VTN — home"
        >
          <KoinoniaMark className="size-7 text-gold-400" />
          <span className="text-[1rem] font-semibold tracking-[-0.02em] text-white">
            Koinonia
            <span className="ml-1.5 font-normal text-white/55">VTN</span>
          </span>
        </Link>

        <div className="max-w-md">
          {eyebrow ? (
            <p className="type-micro mb-3 text-gold-400">{eyebrow}</p>
          ) : null}
          <p className="type-section-title text-white">
            {trustStatement ??
              "Every rider and every driver on this network is verified before a single journey begins."}
          </p>
          <p className="type-meta mt-4 text-white/55">
            Member identity, driver licence, vehicle documents and a physical
            inspection — the same five checks for both tracks.
          </p>
        </div>
      </div>
    </aside>
  );
}
