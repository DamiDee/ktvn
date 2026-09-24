"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

interface LatLng {
  lat: number;
  lng: number;
}

interface MapPickerProps {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
  className?: string;
}

const DEFAULT_CENTER: [number, number] = [9.0579, 7.4951]; // Abuja, Nigeria
const DEFAULT_ZOOM = 12;

export function MapPicker({ value, onChange, className = "" }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Dynamically import Leaflet (SSR-safe, uses local npm package)
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current || mapRef.current) return;
      try {
        const L = (await import("leaflet")).default;

        // Fix default marker icon paths broken by webpack
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        if (cancelled || !containerRef.current || mapRef.current) return;

        const center: [number, number] = value ? [value.lat, value.lng] : DEFAULT_CENTER;
        const map = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView(center, value ? 15 : DEFAULT_ZOOM);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        if (value) {
          markerRef.current = L.marker([value.lat, value.lng]).addTo(map);
        }

        map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
          const { lat, lng } = e.latlng;
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            markerRef.current = L.marker([lat, lng]).addTo(map);
          }
          onChange({
            lat: Math.round(lat * 1e6) / 1e6,
            lng: Math.round(lng * 1e6) / 1e6,
          });
        });

        mapRef.current = map;
        if (!cancelled) {
          setReady(true);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("MapPicker: failed to initialise Leaflet", err);
          setError("Map could not be loaded. Enter coordinates manually below.");
          setLoading(false);
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        setReady(false);
      }
    };
    // value intentionally excluded — initial centre only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external lat/lng changes into the map marker
  useEffect(() => {
    if (!ready || !mapRef.current || !value) return;
    import("leaflet").then(({ default: L }) => {
      if (markerRef.current) {
        markerRef.current.setLatLng([value.lat, value.lng]);
      } else {
        markerRef.current = L.marker([value.lat, value.lng]).addTo(mapRef.current);
      }
      mapRef.current.flyTo([value.lat, value.lng], 15);
    }).catch(() => null);
  }, [ready, value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-[0.8125rem] font-medium text-ink-secondary">
        Pickup / drop-off location{" "}
        <span className="ml-0.5 text-danger-500" aria-hidden>
          *
        </span>
      </p>

      {/* Map container */}
      <div
        className="relative overflow-hidden rounded-[var(--kx-radius-md)] border border-line"
        style={{ height: 280 }}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-nested">
            <span className="type-meta animate-pulse text-ink-muted">Loading map…</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface-nested px-6 text-center">
            <MapPin className="size-8 text-ink-muted/50" aria-hidden />
            <span className="type-meta text-ink-muted">{error}</span>
          </div>
        )}
        <div
          ref={containerRef}
          className="h-full w-full"
          aria-label="Click to select a location on the map"
        />
      </div>

      {/* Pin status hint */}
      {ready && (
        <p className="flex items-center gap-1.5 text-[0.8125rem] text-ink-muted">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          {value
            ? `Selected: ${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`
            : "Tap the map to drop a pin on the location."}
        </p>
      )}

      {/* Always-visible coordinate inputs — primary input when map fails, secondary when it works */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="block text-[0.8125rem] font-medium text-ink-secondary">
            Latitude
          </label>
          <input
            type="number"
            step="any"
            min={-90}
            max={90}
            value={value?.lat ?? ""}
            onChange={(e) => {
              const lat = parseFloat(e.target.value);
              if (!isNaN(lat)) onChange({ lat, lng: value?.lng ?? 0 });
            }}
            placeholder="9.057900"
            className="w-full rounded-[var(--kx-radius-sm)] border border-line-strong bg-surface px-4 h-11 text-[0.9375rem] text-ink placeholder:text-ink-muted focus:outline-none focus:border-forest-500 focus:ring-4 focus:ring-forest-500/10 dark:focus:border-gold-500 dark:focus:ring-gold-500/12 transition-[border-color,box-shadow] duration-[165ms]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[0.8125rem] font-medium text-ink-secondary">
            Longitude
          </label>
          <input
            type="number"
            step="any"
            min={-180}
            max={180}
            value={value?.lng ?? ""}
            onChange={(e) => {
              const lng = parseFloat(e.target.value);
              if (!isNaN(lng)) onChange({ lat: value?.lat ?? 0, lng });
            }}
            placeholder="7.495100"
            className="w-full rounded-[var(--kx-radius-sm)] border border-line-strong bg-surface px-4 h-11 text-[0.9375rem] text-ink placeholder:text-ink-muted focus:outline-none focus:border-forest-500 focus:ring-4 focus:ring-forest-500/10 dark:focus:border-gold-500 dark:focus:ring-gold-500/12 transition-[border-color,box-shadow] duration-[165ms]"
          />
        </div>
      </div>
    </div>
  );
}
