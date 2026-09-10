"use client";

import { motion } from "motion/react";
import { Car, Radio, ShieldCheck } from "lucide-react";
import { MapCanvas } from "@/components/maps/map-canvas";
import { EtaChip } from "@/components/maps/eta-chip";
import { Avatar } from "@/components/ui/avatar";
import { RatingValue } from "@/components/ui/rating";
import { VerifiedBadge } from "@/components/ui/badge";
import { buildRoute } from "@/lib/geo";
import { LOCATIONS } from "@/mocks/locations";
import { DRIVERS } from "@/mocks/people";
import { useRideSimulation } from "@/features/rides/use-ride-simulation";
import { shortName } from "@/lib/format";
import { DriverTrack } from "@/types/enums";

// A short approach leg, so the ETA on screen reads like a driver arriving
// (a few minutes) rather than a whole cross-city journey.
const HERO_ROUTE = buildRoute(LOCATIONS.lugbe, LOCATIONS.koinoniaCentre, {
  seed: "hero-route",
  curvature: 0.24,
});

const HERO_DRIVER = DRIVERS[0];

/**
 * The hero's animated product surface: a live map with a driver approaching,
 * wrapped in floating glass cards.
 */
export function HeroMockup() {
  const { progress, position, heading, etaMinutes } = useRideSimulation({
    route: HERO_ROUTE,
    durationSeconds: 22,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      {/* Soft ambient glow behind the device */}
      <div
        className="absolute -inset-8 -z-10 rounded-[48px] bg-[radial-gradient(60%_60%_at_50%_40%,color-mix(in_srgb,var(--kx-gold-500)_22%,transparent),transparent_72%)] blur-2xl"
        aria-hidden
      />

      <div className="relative overflow-hidden rounded-[var(--kx-radius-2xl)] border border-line-strong bg-surface shadow-xl">
        <MapCanvas
          className="h-[420px] w-full sm:h-[480px]"
          description="Live map showing a verified driver approaching a pickup point in Lugbe, Abuja."
          routes={[
            {
              id: "hero",
              path: HERO_ROUTE,
              variant: "primary",
              progress,
              animateDraw: true,
            },
          ]}
          markers={[
            {
              id: "origin",
              position: LOCATIONS.lugbe,
              kind: "driver-idle",
            },
            {
              id: "pickup",
              position: LOCATIONS.koinoniaCentre,
              kind: "pickup",
              pulse: true,
            },
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
        >
          {/* Live indicator */}
          <div className="absolute top-4 left-4 z-20">
            <span className="surface-glass inline-flex items-center gap-2 rounded-full px-3 py-1.5">
              <span className="relative flex size-1.5">
                <span
                  className="absolute inline-flex size-full rounded-full bg-success-500"
                  style={{ animation: "kx-pulse-ring 2s ease-out infinite" }}
                  aria-hidden
                />
                <span className="relative inline-flex size-1.5 rounded-full bg-success-500" />
              </span>
              <span className="type-micro text-ink">Live tracking</span>
            </span>
          </div>

          <div className="absolute top-4 right-4 z-20">
            <EtaChip minutes={etaMinutes} label="Arriving in" />
          </div>

          {/* Verified driver card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.15, ease: [0.16, 1, 0.3, 1] }}
            className="surface-glass absolute inset-x-4 bottom-4 z-20 rounded-[var(--kx-radius-xl)] p-4"
          >
            <div className="flex items-center gap-3.5">
              <Avatar
                name={HERO_DRIVER.fullName}
                src={HERO_DRIVER.avatarUrl}
                size="lg"
                verified
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="type-card-title text-ink">
                    {shortName(HERO_DRIVER.fullName)}
                  </p>
                  <VerifiedBadge label="Verified Driver" />
                </div>
                <div className="mt-1 flex items-center gap-2.5">
                  <RatingValue value={HERO_DRIVER.rating} />
                  <span className="text-ink-muted" aria-hidden>
                    ·
                  </span>
                  <span className="type-meta text-ink-secondary">
                    {HERO_DRIVER.vehicle.colour} {HERO_DRIVER.vehicle.make}{" "}
                    {HERO_DRIVER.vehicle.model}
                  </span>
                </div>
              </div>

              <div className="hidden shrink-0 rounded-[var(--kx-radius-sm)] bg-[color-mix(in_srgb,var(--kx-text)_6%,transparent)] px-3 py-2 text-center xs:block">
                <p className="type-micro text-ink-muted">Plate</p>
                <p className="type-numeric text-[0.8125rem] font-semibold text-ink">
                  {HERO_DRIVER.vehicle.plateNumber}
                </p>
              </div>
            </div>
          </motion.div>
        </MapCanvas>
      </div>

      {/*
        Floating satellite cards. Positioned clear of the in-map chips at the
        top and the driver card at the bottom, so nothing overlaps.
      */}
      <FloatingCard
        className="absolute top-[38%] -left-7 hidden xl:flex"
        delay={1.35}
        icon={ShieldCheck}
        label="Verification"
        value="Vehicle verified"
      />
      <FloatingCard
        className="absolute top-[26%] -right-7 hidden xl:flex"
        delay={1.5}
        icon={Radio}
        label="Trip sharing"
        value="Active"
      />
      <FloatingCard
        className="absolute -bottom-14 left-6 hidden xl:flex"
        delay={1.65}
        icon={Car}
        label="Track"
        value="Professional · Private"
      />
    </motion.div>
  );
}

function FloatingCard({
  icon: Icon,
  label,
  value,
  delay,
  className,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  delay: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`surface-glass items-center gap-3 rounded-[var(--kx-radius-lg)] px-4 py-3 ${className ?? ""}`}
    >
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-gold-500/15 text-gold-700 dark:text-gold-300">
        <Icon className="size-4" strokeWidth={1.8} aria-hidden />
      </span>
      <div>
        <p className="type-micro text-ink-muted">{label}</p>
        <p className="text-[0.875rem] font-medium text-ink">{value}</p>
      </div>
    </motion.div>
  );
}
