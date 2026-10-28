"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/cn";
import { destinationMarkerHtml, pickupMarkerHtml, userMarkerHtml, vehicleMarkerHtml, radarHtml } from "@/features/paid-rides/maps/markers";
import type { GoogleMapMarker, GoogleMapPath } from "@/features/paid-rides/maps/google-ride-map";
import type { MapCanvasProps } from "./map-types";
const GoogleMap = dynamic(() => import("@/features/paid-rides/maps/google-ride-map").then((module) => module.GoogleRideMap), { ssr: false });

/** Shared Google map for oversight, Free Buses, and the public journey examples. */
export function MapCanvas({ routes = [], markers = [], viewport, loading = false, loadingMessage = "Locating you…", degraded = false, searching = false, className, children, description }: MapCanvasProps) {
  const [failed, setFailed] = useState(false);
  const focus = viewport?.focus?.length ? viewport.focus : [...routes.flatMap((route) => route.path.points), ...markers.map((marker) => marker.position)];
  const paths: GoogleMapPath[] = routes.flatMap((route) => {
    const color = route.variant === "alternate" ? "#81978f" : "#174b3d";
    const path: GoogleMapPath = { id: route.id, points: route.path.points, color, width: route.variant === "alternate" ? 4 : 6, opacity: route.progress ? 0.45 : 1 };
    if (!route.progress) return [path];
    return [path, { ...path, id: `${route.id}-travelled`, points: route.path.points.slice(0, Math.max(2, Math.ceil(route.path.points.length * route.progress))), opacity: 1 }];
  });
  const pins: GoogleMapMarker[] = markers.map((marker) => {
    const destination = marker.kind === "destination", person = marker.kind === "passenger", pickup = marker.kind === "pickup";
    return { id: marker.id, point: marker.position, label: marker.label ?? marker.kind, onClick: marker.onClick, heading: !destination && !person && !pickup ? marker.heading : undefined,
      html: destination ? destinationMarkerHtml(marker.label) : pickup ? pickupMarkerHtml(marker.label) : person ? userMarkerHtml() : vehicleMarkerHtml("sedan", marker.kind === "sos" ? "#c32a3c" : "#d6a527"),
      size: destination ? 34 : pickup ? 28 : person ? 22 : 44, anchorY: destination ? 1 : 0.5 };
  });
  const origin = markers.find((marker) => marker.kind === "pickup")?.position;
  if (searching && origin) pins.unshift({ id: "search-radar", point: origin, html: radarHtml(), size: 220, z: 0 });
  const cameraKey = focus.map((point) => `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`).join(":");
  return <div className={cn("relative isolate overflow-hidden", className)} role="region" aria-label={description}>
    <GoogleMap className="absolute inset-0" paths={paths} markers={pins} camera={focus.length ? { kind: "fit", points: focus } : null} cameraKey={cameraKey} insets={{ top: 0, left: 0, right: viewport?.insetRight ?? 0, bottom: viewport?.insetBottom ?? 0 }} onError={() => setFailed(true)} />
    {loading ? <div role="status" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-surface/60 text-sm text-ink-secondary">{loadingMessage}</div> : null}
    {failed || degraded ? <div role="status" className="absolute left-3 right-3 top-3 z-20 rounded-xl bg-surface px-4 py-3 text-sm text-ink-secondary">{failed ? "Google Maps could not load. Please retry or contact support." : "Live location is temporarily unavailable."}</div> : null}
    {children}
  </div>;
}
