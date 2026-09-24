"use client";

import "leaflet/dist/leaflet.css";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useId,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { MapPin, Search, Loader2, X } from "lucide-react";
import { useMounted } from "@/hooks/use-media-query";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LatLng {
  lat: number;
  lng: number;
}

interface PlaceResult {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
}

export interface MapPickerProps {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
  /** Called when the admin picks a place from the search dropdown. */
  onPlaceSelect?: (place: { name: string; displayName: string }) => void;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [9.0579, 7.4951]; // Abuja, Nigeria
const DEFAULT_ZOOM = 12;
const DEBOUNCE_MS = 320;

// ─── Geocoding ────────────────────────────────────────────────────────────────

async function searchPlaces(q: string): Promise<PlaceResult[]> {
  if (!q || q.length < 2) return [];
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return (await res.json()) as PlaceResult[];
}

// ─── Portalled dropdown ───────────────────────────────────────────────────────

/** Measures the anchor element and renders the dropdown at document.body so
 *  it escapes any overflow:hidden/auto container (e.g. a scrollable modal). */
function SuggestionsPortal({
  anchorRef,
  suggestions,
  activeIdx,
  listId,
  onSelect,
  onHover,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  suggestions: PlaceResult[];
  activeIdx: number;
  listId: string;
  onSelect: (p: PlaceResult) => void;
  onHover: (i: number) => void;
}) {
  const mounted = useMounted();
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Recalculate position whenever the dropdown becomes visible / window resizes
  useEffect(() => {
    function measure() {
      if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect());
    }
    measure();
    window.addEventListener("resize", measure, { passive: true });
    window.addEventListener("scroll", measure, { passive: true, capture: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, { capture: true });
    };
  }, [anchorRef]);

  if (!mounted || !rect || suggestions.length === 0) return null;

  return createPortal(
    <ul
      id={listId}
      role="listbox"
      style={{
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      }}
      className="max-h-72 overflow-y-auto rounded-[var(--kx-radius-md)] border border-line bg-surface shadow-2xl"
    >
      {suggestions.map((place, i) => (
        <li
          key={place.id}
          id={`${listId}-option-${i}`}
          role="option"
          aria-selected={i === activeIdx}
          onMouseDown={(e) => {
            // Prevent the input from losing focus before click registers
            e.preventDefault();
            onSelect(place);
          }}
          onMouseEnter={() => onHover(i)}
          className={[
            "flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors",
            i === activeIdx ? "bg-forest-50 dark:bg-forest-900/60" : "hover:bg-surface-nested",
            i !== 0 ? "border-t border-line" : "",
          ].join(" ")}
        >
          <MapPin
            className="mt-0.5 size-4 shrink-0 text-forest-600 dark:text-gold-400"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="truncate text-[0.9rem] font-medium text-ink">{place.name}</p>
            <p className="mt-0.5 truncate text-[0.775rem] text-ink-muted">{place.displayName}</p>
          </div>
        </li>
      ))}
    </ul>,
    document.body,
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MapPicker({ value, onChange, onPlaceSelect, className = "" }: MapPickerProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState("");

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  // ─── Map init ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current || mapRef.current) return;
      try {
        const L = (await import("leaflet")).default;
        LRef.current = L;

        // Fix webpack-broken default marker icons
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        if (cancelled || !containerRef.current || mapRef.current) return;

        const center: [number, number] = value
          ? [value.lat, value.lng]
          : DEFAULT_CENTER;

        const map = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView(center, value ? 15 : DEFAULT_ZOOM);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
          maxZoom: 19,
        }).addTo(map);

        if (value) {
          markerRef.current = L.marker([value.lat, value.lng]).addTo(map);
        }

        map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
          const { lat, lng } = e.latlng;
          placePin(lat, lng);
          onChange({ lat: round(lat), lng: round(lng) });
        });

        mapRef.current = map;
        if (!cancelled) {
          setMapReady(true);
          setMapLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("MapPicker init error:", err);
          setMapError("Map could not be loaded. Use the coordinate inputs below.");
          setMapLoading(false);
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
        setMapReady(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const round = (n: number) => Math.round(n * 1e6) / 1e6;

  const placePin = useCallback((lat: number, lng: number) => {
    if (!mapRef.current || !LRef.current) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = LRef.current.marker([lat, lng]).addTo(mapRef.current);
    }
  }, []);

  // Sync external value → map
  useEffect(() => {
    if (!mapReady || !value) return;
    placePin(value.lat, value.lng);
    mapRef.current?.flyTo([value.lat, value.lng], 15);
  }, [mapReady, placePin, value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Autocomplete ─────────────────────────────────────────────────────────

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    setActiveIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q.trim() || q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchPlaces(q);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
  };

  const selectPlace = useCallback(
    (place: PlaceResult) => {
      setQuery(place.name);
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveIdx(-1);

      const lat = round(place.lat);
      const lng = round(place.lng);

      if (mapRef.current && LRef.current) {
        placePin(lat, lng);
        mapRef.current.flyTo([lat, lng], 16);
      }

      onChange({ lat, lng });
      onPlaceSelect?.({ name: place.name, displayName: place.displayName });
    },
    [onChange, onPlaceSelect, placePin],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      selectPlace(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Label */}
      <p className="text-[0.8125rem] font-medium text-ink-secondary">
        Pickup / drop-off location{" "}
        <span className="ml-0.5 text-danger-500" aria-hidden>
          *
        </span>
      </p>

      {/* ── Search bar ── */}
      <div className="relative">
        <div className="relative flex items-center" ref={inputRef as React.RefObject<HTMLDivElement>}>
          {searching ? (
            <Loader2
              className="pointer-events-none absolute left-3.5 top-1/2 size-[1.05rem] -translate-y-1/2 animate-spin text-ink-muted"
              aria-hidden
            />
          ) : (
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-[1.05rem] -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
          )}
          <input
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={showSuggestions}
            aria-activedescendant={
              activeIdx >= 0 ? `${listId}-option-${activeIdx}` : undefined
            }
            value={query}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            onFocus={() =>
              query.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)
            }
            onBlur={() =>
              // Delay so onMouseDown on a suggestion fires before the dropdown hides
              setTimeout(() => setShowSuggestions(false), 200)
            }
            placeholder="Search for a place — e.g. Chida Event Center, Lugbe…"
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-[var(--kx-radius-sm)] border border-line-strong bg-surface pl-10.5 pr-9 text-[0.9375rem] text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] duration-[165ms] focus:border-forest-500 focus:outline-none focus:ring-4 focus:ring-forest-500/10 dark:focus:border-gold-500 dark:focus:ring-gold-500/12"
          />
          {query && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()} // keep focus on input
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                setShowSuggestions(false);
                inputRef.current?.querySelector("input")?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-muted transition-colors hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown rendered via portal — escapes overflow:hidden of the modal */}
        {showSuggestions && (
          <SuggestionsPortal
            anchorRef={inputRef as React.RefObject<HTMLElement>}
            suggestions={suggestions}
            activeIdx={activeIdx}
            listId={listId}
            onSelect={selectPlace}
            onHover={setActiveIdx}
          />
        )}
      </div>

      {/* ── Map canvas ── */}
      <div
        className="relative overflow-hidden rounded-[var(--kx-radius-md)] border border-line"
        style={{ height: 300 }}
      >
        {mapLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-nested">
            <Loader2 className="size-6 animate-spin text-ink-muted" aria-hidden />
          </div>
        )}
        {mapError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-surface-nested px-6 text-center">
            <MapPin className="size-8 text-ink-muted/40" aria-hidden />
            <p className="type-meta text-ink-muted">{mapError}</p>
          </div>
        )}
        <div
          ref={containerRef}
          className="h-full w-full"
          aria-label="Map — click to place a pin"
        />
        {mapReady && !value && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[0.75rem] text-white backdrop-blur-sm whitespace-nowrap">
            Search above · or tap the map to pin a location
          </div>
        )}
      </div>

      {/* Coords readout */}
      {value && (
        <p className="flex items-center gap-1.5 text-[0.8125rem] text-forest-700 dark:text-gold-400">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          Pinned at {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
        </p>
      )}

      {/* ── Manual coordinate inputs ── */}
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { label: "Latitude", key: "lat" as const, min: -90, max: 90, placeholder: "9.057900" },
            {
              label: "Longitude",
              key: "lng" as const,
              min: -180,
              max: 180,
              placeholder: "7.495100",
            },
          ] as const
        ).map(({ label, key, min, max, placeholder }) => (
          <div key={key} className="space-y-1.5">
            <label className="block text-[0.8125rem] font-medium text-ink-secondary">
              {label}
            </label>
            <input
              type="number"
              step="any"
              min={min}
              max={max}
              value={value?.[key] ?? ""}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                if (!isNaN(n)) onChange({ lat: value?.lat ?? 0, lng: value?.lng ?? 0, [key]: n });
              }}
              placeholder={placeholder}
              className="h-11 w-full rounded-[var(--kx-radius-sm)] border border-line-strong bg-surface px-4 text-[0.9375rem] text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] duration-[165ms] focus:border-forest-500 focus:outline-none focus:ring-4 focus:ring-forest-500/10 dark:focus:border-gold-500 dark:focus:ring-gold-500/12"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
