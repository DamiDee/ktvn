"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getMapProvider } from "@/features/paid-rides/services";
import { resolvePlaceSelection } from "@/features/paid-rides/maps/resolve-place";
import type { PlaceSuggestion } from "@/features/paid-rides/domain/types";
import { PlaceAttribution } from "@/features/paid-rides/components/place-attribution";
import {
  useEffect,
  useRef,
  useState,
  useId,
} from "react";
import { createPortal } from "react-dom";
import { MapPin, Search, Loader2, X } from "lucide-react";
import { useMounted } from "@/hooks/use-media-query";


// ─── Types ────────────────────────────────────────────────────────────────────

interface LatLng {
  lat: number;
  lng: number;
}

type PlaceResult = PlaceSuggestion & { displayName: string };

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
const round = (n: number) => Math.round(n * 1e6) / 1e6;

// ─── Geocoding ────────────────────────────────────────────────────────────────

async function searchPlaces(q: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  return (await getMapProvider().searchPlaces(q, { signal })).map((place) => ({ ...place, displayName: place.secondary }));
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
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => onSelect(place)}
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

const GoogleMap = dynamic(() => import("@/features/paid-rides/maps/google-ride-map").then((module) => module.GoogleRideMap), { ssr: false });

export function MapPicker({ value, onChange, onPlaceSelect, className = "" }: MapPickerProps) {
  const listId = useId(), anchor = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null), operation = useRef(0);
  const [query, setQuery] = useState(""), [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const [resolving, setResolving] = useState(false), [error, setError] = useState("");
  const [ready, setReady] = useState(false), [mapFailed, setMapFailed] = useState(false);
  const debounced = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const results = useQuery({ queryKey: ["google", "admin-place-search", debounced], queryFn: ({ signal }) => searchPlaces(debounced, signal), enabled: open && debounced.length >= 2, retry: false, staleTime: 60_000 });
  const places = query.trim() === debounced ? results.data ?? [] : [];
  useEffect(() => () => { operation.current += 1; }, []);
  useEffect(() => {
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && !anchor.current?.contains(event.target) && !document.getElementById(listId)?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("focusin", dismiss);
    return () => { document.removeEventListener("pointerdown", dismiss, true); document.removeEventListener("focusin", dismiss); };
  }, [listId]);
  async function select(place: PlaceResult) {
    const token = ++operation.current; setResolving(true); setError("");
    try {
      const confirmed = await resolvePlaceSelection(getMapProvider(), place);
      if (token !== operation.current) return;
      setQuery(confirmed.name); setOpen(false); setActive(-1);
      onChange({ lat: round(confirmed.point.lat), lng: round(confirmed.point.lng) });
      onPlaceSelect?.({ name: confirmed.name, displayName: confirmed.secondary });
    } catch { if (token === operation.current) setError("This place could not be confirmed. Try another result or choose on the map."); }
    finally { if (token === operation.current) setResolving(false); }
  }
  return <div className={`space-y-3 ${className}`}>
    <p className="text-sm font-medium text-ink-secondary">Pickup / drop-off location <span aria-hidden className="text-danger-500">*</span></p>
    <div ref={anchor} className="relative">
      <Search className="pointer-events-none absolute left-3 top-3 size-5 text-ink-muted" aria-hidden />
      <input ref={input} role="combobox" aria-label="Search for a place" aria-autocomplete="list" aria-controls={listId} aria-expanded={open && places.length > 0} aria-activedescendant={active >= 0 ? `${listId}-option-${active}` : undefined}
        value={query} disabled={resolving} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} autoComplete="off" spellCheck={false} placeholder="Search for a place in FCT…"
        onChange={(event) => { operation.current += 1; setQuery(event.target.value); setOpen(true); setActive(-1); setError(""); }}
        onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setActive((v) => Math.min(v + 1, places.length - 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setActive((v) => Math.max(v - 1, 0)); } if (event.key === "Enter" && places[active]) { event.preventDefault(); void select(places[active]); } if (event.key === "Escape") setOpen(false); }}
        className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-10 text-base text-ink" />
      {query ? <button type="button" aria-label="Clear search" className="absolute right-2 top-2 p-1.5" onClick={() => { operation.current += 1; setQuery(""); setOpen(false); setResolving(false); input.current?.focus(); }}><X className="size-4" aria-hidden /></button> : null}
      {open ? <SuggestionsPortal anchorRef={anchor} suggestions={places} activeIdx={active} listId={listId} onSelect={(place) => void select(place)} onHover={setActive} /> : null}
    </div>
    {(results.isFetching && open) || resolving ? <p role="status" className="text-xs text-ink-muted">{resolving ? "Confirming location…" : "Finding places…"}</p> : null}
    {results.isError || error ? <p role="alert" className="text-sm text-danger-600">{error || "Place search is unavailable. Retry or choose a point on the map."}</p> : null}
    {open && places.length ? <PlaceAttribution /> : null}
    <div className="relative isolate h-[300px] overflow-hidden rounded-xl border border-line" aria-label="Map — click to place a pin">
      <GoogleMap className="absolute inset-0" camera={{ kind: "point", point: value ?? { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] }, zoom: value ? 16 : DEFAULT_ZOOM }} cameraKey={`${value?.lat},${value?.lng}`} pickup={value} insets={{ top: 0, right: 0, bottom: 0, left: 0 }} zoomControl interactive={!resolving}
        onReady={() => setReady(true)} onError={() => { setMapFailed(true); setReady(false); }} onMapClick={(point) => { operation.current += 1; setResolving(false); setOpen(false); onChange({ lat: round(point.lat), lng: round(point.lng) }); }} />
      {!ready || mapFailed ? <div role="status" className="absolute inset-0 flex items-center justify-center bg-surface-nested p-4 text-center text-sm text-ink-secondary">{mapFailed ? "The map could not load. Use the coordinate inputs below." : <Loader2 className="size-6 animate-spin" aria-label="Loading Google Maps" />}</div> : null}
    </div>
    {value ? <p className="text-xs text-ink-secondary">Pinned at {value.lat.toFixed(6)}, {value.lng.toFixed(6)}</p> : null}
    <div className="grid grid-cols-2 gap-3">{(["lat", "lng"] as const).map((key) => <label key={key} className="space-y-1 text-sm text-ink-secondary">{key === "lat" ? "Latitude" : "Longitude"}<input type="number" step="any" min={key === "lat" ? -90 : -180} max={key === "lat" ? 90 : 180} value={value?.[key] ?? ""} onChange={(event) => { const n = Number.parseFloat(event.target.value); if (Number.isFinite(n) && Math.abs(n) <= (key === "lat" ? 90 : 180)) { operation.current += 1; setResolving(false); setOpen(false); onChange({ lat: value?.lat ?? DEFAULT_CENTER[0], lng: value?.lng ?? DEFAULT_CENTER[1], [key]: n }); } }} className="block h-11 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink" /></label>)}</div>
  </div>;
}
