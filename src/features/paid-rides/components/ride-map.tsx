"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { MapPinOff } from "lucide-react";
import type { RideMapProps } from "../maps/leaflet-ride-map";

/**
 * The map, loaded lazily so the heavy Leaflet bundle never blocks the first
 * paint of a ride screen. While it loads, a skeleton in the map's own colours
 * with a pulsing location dot holds the space; if it fails, the screen keeps
 * working and says so.
 */

function MapSkeleton() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--kx-map-land)]" aria-hidden>
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(var(--kx-map-road) 2px, transparent 2px), linear-gradient(90deg, var(--kx-map-road) 2px, transparent 2px)",
          backgroundSize: "88px 88px, 88px 88px",
          backgroundPosition: "-14px -30px",
        }}
      />
      <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="ride-pulse-ring absolute -inset-6 rounded-full bg-[var(--ride-info)] opacity-30" />
        <span className="relative block size-4 rounded-full border-[3px] border-white bg-[var(--ride-info)]" />
      </div>
    </div>
  );
}

const LeafletRideMap = dynamic(() => import("../maps/leaflet-ride-map").then((module) => module.LeafletRideMap), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export function RideMap(props: Omit<RideMapProps, "onError">) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  if (failed) {
    return (
      <div className="absolute inset-0 isolate z-0 flex items-start justify-center bg-[var(--kx-map-land)] px-6 pt-[calc(var(--ride-safe-top)+5rem)]">
        <div className="flex max-w-xs items-start gap-3 rounded-[var(--ride-radius-lg)] bg-[var(--surface-primary)] p-4 shadow-[var(--ride-elev-2)]" role="status">
          <MapPinOff className="mt-0.5 size-5 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
          <p className="ride-body-sm text-[var(--text-secondary)]">
            The map couldn&apos;t load. Your trip details below are still live and up to date.
          </p>
        </div>
      </div>
    );
  }

  return (
    // `isolate` keeps Leaflet's internal z-indexes (400+) inside the map, so
    // sheets, nav and overlays always sit above it.
    <div className="absolute inset-0 isolate z-0">
      {!ready ? <MapSkeleton /> : null}
      <LeafletRideMap
        {...props}
        className="absolute inset-0"
        onReady={() => {
          setReady(true);
          props.onReady?.();
        }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
