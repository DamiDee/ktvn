"use client";

import "leaflet/dist/leaflet.css";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { useTheme } from "next-themes";
import { PAID_RIDES_CONFIG } from "@/features/paid-rides/config";
import { mapTileSource } from "@/lib/map-tiles";
import type { LiveDriver } from "./data/admin-data";

/**
 * Leaflet + OSM map of online drivers for the admin live map.
 *
 * Markers are keyed by `driverId`: each snapshot adds new drivers, moves the
 * ones still online and removes the ones the server dropped. The Leaflet
 * instance is created once and opens on Abuja; it never re-frames on its own
 * after that, so a poll doesn't yank the map away from whoever is looking.
 */

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

/** Only rebuild a marker's icon when something it draws has changed. */
function iconKey(driver: LiveDriver, selected: boolean): string {
  return `${driver.currentRide ? "busy" : "idle"}:${driver.heading ?? "-"}:${selected ? 1 : 0}`;
}

export const LiveDriversMap = forwardRef<LiveDriversMapHandle, LiveDriversMapProps>(function LiveDriversMap(
  { drivers, selectedId, onSelect, onError, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const tiles = useRef<Leaflet.TileLayer | null>(null);
  const markers = useRef(new Map<string, { marker: Leaflet.Marker; key: string }>());
  const callbacks = useRef({ onSelect, onError });
  const [ready, setReady] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    callbacks.current = { onSelect, onError };
  });

  useImperativeHandle(ref, () => ({
    fitAll() {
      const instance = map.current;
      const leaflet = L.current;
      if (!instance || !leaflet || markers.current.size === 0) return;
      const bounds = leaflet.latLngBounds([...markers.current.values()].map(({ marker }) => marker.getLatLng()));
      instance.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
    },
  }), []);

  // ─── Init (once) ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const placed = markers.current;
    void (async () => {
      try {
        const leaflet = (await import("leaflet")).default;
        if (cancelled || !containerRef.current || map.current) return;
        L.current = leaflet;
        const instance = leaflet.map(containerRef.current, { zoomControl: true, attributionControl: true, maxZoom: 18, minZoom: 5 });
        instance.attributionControl.setPrefix(false);
        instance.setView([PAID_RIDES_CONFIG.defaultCenter.lat, PAID_RIDES_CONFIG.defaultCenter.lng], 12);
        map.current = instance;
        setReady(true);
      } catch {
        if (!cancelled) callbacks.current.onError?.();
      }
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      tiles.current = null;
      placed.clear();
    };
  }, []);

  // ─── Tiles follow the theme ───────────────────────────────────────────

  useEffect(() => {
    const instance = map.current;
    const leaflet = L.current;
    if (!ready || !instance || !leaflet) return;
    const dark = resolvedTheme === "dark";
    const source = mapTileSource({ dark, customUrl: dark ? PAID_RIDES_CONFIG.tiles.dark : PAID_RIDES_CONFIG.tiles.light });
    if (tiles.current && (tiles.current as Leaflet.TileLayer & { _url?: string })._url === source.url) return;
    tiles.current?.remove();
    tiles.current = leaflet.tileLayer(source.url, { maxZoom: 19, attribution: source.attribution, subdomains: source.subdomains }).addTo(instance);
  }, [ready, resolvedTheme]);

  // ─── Markers: add, move, remove by driverId ───────────────────────────

  useEffect(() => {
    const instance = map.current;
    const leaflet = L.current;
    if (!ready || !instance || !leaflet) return;
    const placed = markers.current;
    const online = new Set(drivers.map((driver) => driver.driverId));
    for (const [driverId, entry] of placed) {
      if (!online.has(driverId)) {
        entry.marker.remove();
        placed.delete(driverId);
      }
    }
    for (const driver of drivers) {
      const selected = driver.driverId === selectedId;
      const key = iconKey(driver, selected);
      const existing = placed.get(driver.driverId);
      const icon = () => leaflet.divIcon({
        html: markerHtml(driver, selected),
        className: "live-driver-marker",
        iconSize: [MARKER_SIZE, MARKER_SIZE],
        iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
      });
      const label = `${driver.displayName}, ${driver.currentRide ? "on a ride" : "idle"}`;
      if (existing) {
        existing.marker.setLatLng([driver.lat, driver.lng]);
        if (existing.key !== key) {
          existing.marker.setIcon(icon());
          existing.marker.setZIndexOffset(selected ? 1_000 : 0);
          existing.key = key;
        }
        existing.marker.options.title = label;
      } else {
        const marker = leaflet
          .marker([driver.lat, driver.lng], { icon: icon(), title: label, alt: label, keyboard: true, zIndexOffset: selected ? 1_000 : 0 })
          .on("click", () => callbacks.current.onSelect(driver.driverId))
          .addTo(instance);
        placed.set(driver.driverId, { marker, key });
      }
    }
  }, [ready, drivers, selectedId]);

  // ─── Bring the selected driver into view ──────────────────────────────

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !selectedId) return;
    const entry = markers.current.get(selectedId);
    if (!entry) return;
    const point = entry.marker.getLatLng();
    if (!instance.getBounds().pad(-0.1).contains(point)) instance.panTo(point);
    // Only on selection, not on every poll that moves the driver.
  }, [ready, selectedId]);

  return <div ref={containerRef} className={className} role="region" aria-label="Map of online drivers" />;
});
