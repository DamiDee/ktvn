"use client";
import { forwardRef, useImperativeHandle, useRef } from "react";
import dynamic from "next/dynamic";
import { PAID_RIDES_CONFIG } from "@/features/paid-rides/config";
import type { RideMapHandle } from "@/features/paid-rides/maps/map-provider";
import type { LiveDriver } from "./data/admin-data";
const GoogleMap = dynamic(() => import("@/features/paid-rides/maps/google-ride-map").then((module) => module.GoogleRideMap), { ssr: false });
export interface LiveDriversMapHandle {
  /** Frame every driver currently on the map. */
  fitAll(): void;
}

interface LiveDriversMapProps {
  drivers: LiveDriver[];
  selectedId: string | null;
  onSelect: (driverId: string) => void;
  onError?: () => void;
  className?: string;
}

const MARKER_SIZE = 30;

function markerHtml(driver: LiveDriver, selected: boolean): string {
  const busy = driver.currentRide !== null;
  const fill = busy ? "var(--kx-gold-500)" : "var(--kx-forest-600)";
  const ring = selected ? "0 0 0 3px var(--kx-surface, #fff), 0 0 0 6px var(--kx-forest-900)" : "0 1px 4px rgb(0 0 0 / 0.35)";
  const arrow = driver.heading !== null
    ? `<svg viewBox="0 0 24 24" width="16" height="16" style="transform:rotate(${driver.heading}deg)" aria-hidden="true"><path d="M12 3 19 20 12 16 5 20Z" fill="#fff"/></svg>`
    : `<span style="width:8px;height:8px;border-radius:9999px;background:#fff"></span>`;
  return `<div style="width:${MARKER_SIZE}px;height:${MARKER_SIZE}px;border-radius:9999px;background:${fill};border:2px solid #fff;box-shadow:${ring};display:flex;align-items:center;justify-content:center">${arrow}</div>`;
}

export const LiveDriversMap = forwardRef<LiveDriversMapHandle, LiveDriversMapProps>(function LiveDriversMap({ drivers, selectedId, onSelect, onError, className }, ref) {
  const map = useRef<RideMapHandle>(null);
  const latest = useRef(drivers); latest.current = drivers;
  useImperativeHandle(ref, () => ({ fitAll() { map.current?.fitRouteBounds(latest.current.map((driver) => ({ lat: driver.lat, lng: driver.lng }))); } }), []);
  return <div className={className} role="region" aria-label="Live driver locations"><div className="relative h-full min-h-80 w-full">
    <GoogleMap ref={map} className="absolute inset-0" camera={{ kind: "point", point: PAID_RIDES_CONFIG.defaultCenter, zoom: 12 }} cameraKey="admin-drivers" insets={{ top: 0, right: 0, bottom: 0, left: 0 }} zoomControl onError={onError}
      markers={drivers.map((driver) => ({ id: driver.driverId, point: { lat: driver.lat, lng: driver.lng }, html: markerHtml(driver, driver.driverId === selectedId), size: MARKER_SIZE, z: driver.driverId === selectedId ? 1000 : 1, label: `${driver.displayName}, ${driver.currentRide ? "on a ride" : "idle"}`, onClick: () => onSelect(driver.driverId) }))} />
  </div></div>;
});
