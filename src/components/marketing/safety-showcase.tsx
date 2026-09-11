"use client";

import { motion } from "motion/react";
import {
  ChevronDown,
  Eye,
  MapPin,
  Share2,
  ShieldAlert,
  Users,
} from "lucide-react";
import { MapCanvas } from "@/components/maps/map-canvas";
import { buildRoute } from "@/lib/geo";
import { LOCATIONS } from "@/mocks/locations";
import { useRideSimulation } from "@/features/rides/use-ride-simulation";
import { DriverTrack } from "@/types/enums";
import { viewportOnce } from "@/lib/motion";
import { Reveal } from "./section";

const SAFETY_ROUTE = buildRoute(LOCATIONS.koinoniaCentre, LOCATIONS.lifeCamp, {
  seed: "safety-route",
});

const CAPABILITIES = [
  {
    icon: MapPin,
    title: "Live location",
    body: "See the route, vehicle and current position.",
  },
  {
    icon: Share2,
    title: "Share Trip",
    body: "Send a live link to someone you trust.",
  },
  {
    icon: ShieldAlert,
    title: "SOS",
    body: "Alert the safety team and share your location.",
  },
  {
    icon: Users,
    title: "Driver details",
    body: "Confirm the person, car, colour and plate before boarding.",
  },
  {
    icon: Eye,
    title: "Admin monitoring",
    body: "The safety team can respond to active alerts.",
  },
];

export function SafetyShowcase() {
  const { progress, position, heading } = useRideSimulation({
    route: SAFETY_ROUTE,
    durationSeconds: 30,
  });

  return (
    <div className="mt-9 grid gap-6 sm:mt-11 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
      <Reveal>
        <div className="overflow-hidden rounded-[var(--kx-radius-2xl)] border border-white/10 shadow-xl">
          <MapCanvas
            className="h-[320px] w-full sm:h-[380px]"
            description="A journey in progress from Koinonia Centre to Life Camp, with the vehicle position and route visible."
            routes={[
              {
                id: "safety",
                path: SAFETY_ROUTE,
                variant: "primary",
                progress,
                animateDraw: true,
              },
            ]}
            markers={[
              {
                id: "pickup",
                position: LOCATIONS.koinoniaCentre,
                kind: "pickup",
              },
              {
                id: "destination",
                position: LOCATIONS.lifeCamp,
                kind: "destination",
              },
              ...(position
                ? [
                    {
                      id: "vehicle",
                      position,
                      kind: "vehicle" as const,
                      heading,
                      track: DriverTrack.VOLUNTEER,
                    },
                  ]
                : []),
            ]}
          >
            {/* Persistent trip controls, always within reach */}
            <div className="absolute inset-x-4 bottom-4 z-20 flex items-center gap-3">
              <span className="surface-glass flex flex-1 items-center gap-2.5 rounded-full px-4 py-3">
                <Share2 className="size-4 shrink-0 text-ink-secondary" strokeWidth={1.8} aria-hidden />
                <span className="type-meta font-medium text-ink">Share Trip</span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-sos-500 px-5 py-3 text-[0.875rem] font-semibold text-white shadow-md">
                <ShieldAlert className="size-4" strokeWidth={2} aria-hidden />
                SOS
              </span>
            </div>
          </MapCanvas>
        </div>
      </Reveal>

      <div className="space-y-3">
        {CAPABILITIES.map((capability, index) => {
          const Icon = capability.icon;
          return (
            <motion.details
              key={capability.title}
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={viewportOnce}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="group overflow-hidden rounded-[var(--kx-radius-lg)] border border-white/8 bg-white/[0.04]"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 p-3.5 outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
                  <Icon className="size-4" strokeWidth={1.8} aria-hidden />
                </span>
                <span className="type-meta flex-1 font-semibold text-white">
                  {capability.title}
                </span>
                <ChevronDown
                  className="size-4 shrink-0 text-white/45 transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="type-meta border-t border-white/8 px-4 py-3 text-white/60">
                {capability.body}
              </p>
            </motion.details>
          );
        })}

        <Reveal delay={0.4}>
          <p className="type-meta pt-2 text-white/45">
            Safety tools reduce risk; they don&rsquo;t remove it.
          </p>
        </Reveal>
      </div>
    </div>
  );
}
