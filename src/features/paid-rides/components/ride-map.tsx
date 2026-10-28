"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { getMapProvider } from "../services";
import { USE_GOOGLE_MAPS } from "../config";
import type { GeoPoint, RouteGeometry } from "../domain/types";
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
const GoogleRideMap = dynamic(() => import("../maps/google-ride-map").then((module) => module.GoogleRideMap), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function useRoadRoute(route: RouteGeometry | null | undefined, from?: GeoPoint | null, to?: GeoPoint | null, moving = false) {
  const start = route?.points[0] ?? from;
  const end = route?.points.at(-1) ?? to;
  const needsRoad = route?.source !== "road" && Boolean(start && end);
  // About 100 m buckets avoid a new request for every five-second GPS fix.
  const precision = moving ? 3 : 5;
  const key = start && end ? [moving ? "approach" : "trip", start.lat.toFixed(precision), start.lng.toFixed(precision), end.lat.toFixed(5), end.lng.toFixed(5)] : [];
  const query = useQuery({
    queryKey: ["paid-rides", "road-route", ...key],
    queryFn: async ({ signal }) => {
      const result = await getMapProvider().calculateRoute([start!, end!], signal);
      if (result.source !== "road") throw new Error("Road route unavailable");
      return result;
    },
    enabled: needsRoad,
    staleTime: 600_000,
    gcTime: 1_800_000,
    retry: 1,
    retryDelay: 5_000,
    refetchOnWindowFocus: false,
  });
  return { route: route?.source === "road" ? route : needsRoad ? query.data ?? null : null, loading: needsRoad && query.isFetching, failed: needsRoad && query.isError };
}

export function RideMap(props: RideMapProps & { failureMessage?: string }) {
  const MapComponent = USE_GOOGLE_MAPS ? GoogleRideMap : LeafletRideMap;
  const road = useRoadRoute(props.route);
  const approach = useRoadRoute(props.approaching ? props.approachRoute : null,
    props.approaching ? props.vehicle?.point : null, props.approaching ? props.pickup : null, true);
  const routing = road.loading || approach.loading;
  const routingFailed = road.failed || approach.failed;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  if (failed) {
    return (
      <div className="absolute inset-0 isolate z-0 flex items-start justify-center bg-[var(--kx-map-land)] px-6 pt-[calc(var(--ride-safe-top)+5rem)]">
        <div className="flex max-w-xs items-start gap-3 rounded-[var(--ride-radius-lg)] bg-[var(--surface-primary)] p-4 shadow-[var(--ride-elev-2)]" role="status">
          <MapPinOff className="mt-0.5 size-5 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
          <p className="ride-body-sm text-[var(--text-secondary)]">
            {props.failureMessage ?? "The map couldn't load. Your trip details below are still live and up to date."}
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
      <MapComponent
        {...props}
        route={road.route}
        approachRoute={approach.route}
        className="absolute inset-0"
        onReady={() => {
          setReady(true);
          props.onReady?.();
        }}
        onError={() => { setReady(false); setFailed(true); props.onError?.(); }}
      />
      {routing || routingFailed ? <div role="status" className="pointer-events-none absolute left-4 top-20 z-[500] flex items-center gap-2 rounded-full bg-[var(--surface-primary)] px-3 py-2 text-xs shadow-sm">
        {routing ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
        {routing ? "Finding a road route…" : "Road route unavailable. Locations are still live."}
      </div> : null}
    </div>
  );
}
