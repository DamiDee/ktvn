"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LocateFixed, MapPin, MapPinned, Navigation, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PAID_RIDES_CONFIG } from "../config";
import type { GeoPoint, Place } from "../domain/types";
import { formatDistance, formatDuration } from "../domain/format";
import { RideMap } from "../components/ride-map";
import { MetricRow } from "../components/ride-ui";
import { getMapProvider } from "../services";
import { scheduleError } from "./booking-card";

type Field = "pickup" | "destination";

function AddressField({ field, value, near, disabled, suggestions, onChange, onPin, onLocate }: {
  field: Field; value: Place | null; near?: GeoPoint; disabled: boolean; suggestions: Place[];
  onChange: (value: Place | null) => void; onPin: () => void; onLocate?: () => void;
}) {
  const [text, setText] = useState(""), [editing, setEditing] = useState(false), [active, setActive] = useState(-1);
  const container = useRef<HTMLDivElement>(null);
  const debounced = useDebouncedValue(text.trim(), PAID_RIDES_CONFIG.searchDebounceMs);
  const id = useId(), label = field === "pickup" ? "Pickup" : "Destination";
  const searching = editing && debounced.length >= PAID_RIDES_CONFIG.searchMinChars;
  const results = useQuery({
    queryKey: ["paid-rides", "schedule-places", debounced, near?.lat.toFixed(2), near?.lng.toFixed(2)],
    queryFn: ({ signal }) => getMapProvider().searchPlaces(debounced, { near, signal }),
    enabled: searching && !disabled, staleTime: 300_000, retry: 1, refetchOnWindowFocus: false,
  });
  const typing = text.trim() !== debounced;
  const places = searching ? typing ? [] : results.data ?? [] : suggestions;
  const expanded = editing && !disabled;
  // Safari may blur an input with a null relatedTarget before a tapped option's
  // click arrives. Dismiss only when interaction actually leaves this field.
  useEffect(() => {
    if (!expanded) return;
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) {
        setEditing(false); setActive(-1);
      }
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, [expanded]);
  function select(place: Place) { onChange(place); setText(place.name); setEditing(false); setActive(-1); }
  return <div ref={container} className="min-w-0 space-y-2">
    <Input label={label} icon={MapPin} className="text-base" disabled={disabled} value={editing ? text : value?.name ?? ""}
      placeholder={field === "pickup" ? "Where should we pick you up?" : "Where are you going?"}
      role="combobox" aria-expanded={expanded} aria-controls={id} aria-autocomplete="list"
      aria-activedescendant={expanded && places[active] ? `${id}-${active}` : undefined}
      autoComplete="off" enterKeyHint="search"
      onFocus={() => { setText(value?.name ?? text); setEditing(true); }}
      onClick={() => { if (!editing) { setText(value?.name ?? text); setEditing(true); } }}
      onChange={(event) => { setText(event.target.value); setEditing(true); setActive(-1); onChange(null); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(index + 1, places.length - 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(0, index - 1)); }
        if (event.key === "Enter") { event.preventDefault(); if (places[active]) select(places[active]); }
        if (event.key === "Escape") { setEditing(false); setActive(-1); }
      }}
    />
    {expanded ? <div className="rounded-[var(--kx-radius-md)] border border-line bg-surface-nested p-2">
      {searching && (typing || results.isFetching) ? <div className="space-y-2 p-2" role="status" aria-label="Finding places"><div className="kx-skeleton h-4 w-3/4" /><div className="kx-skeleton h-4 w-1/2" /></div> : null}
      {searching && results.isError && !typing ? <div role="alert" className="p-2"><p className="ride-body-sm">Search could not load. Try again or choose the spot on the map.</p><Button size="sm" variant="ghost" onClick={() => void results.refetch()}>Try again</Button></div> : null}
      <ul id={id} role="listbox" aria-label={`${label} locations`} className="max-h-56 overflow-y-auto">
        {places.map((place, index) => <li key={`${place.id}-${index}`} role="presentation"><button id={`${id}-${index}`} role="option" aria-selected={index === active} type="button" onClick={() => select(place)} className={`ride-press w-full rounded-xl px-3 py-3 text-left ${active === index ? "bg-surface" : "hover:bg-surface"}`}><span className="ride-body-sm block font-medium">{place.name}</span><span className="ride-caption block">{place.secondary}</span></button></li>)}
      </ul>
      {searching && !typing && results.isSuccess && !places.length ? <p className="ride-caption p-2">No matching places. Add the area name or choose on the map.</p> : null}
      <div className="flex flex-wrap gap-1 border-t border-line pt-2">
      {onLocate ? <Button pill size="sm" variant="ghost" icon={LocateFixed} disabled={disabled} onClick={() => { setEditing(false); onLocate(); }}>Use current location</Button> : null}
      <Button pill size="sm" variant="ghost" icon={MapPinned} disabled={disabled} onClick={() => { setEditing(false); onPin(); }}>Choose on map</Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Close suggestions</Button>
      </div>
    </div> : null}
  </div>;
}

const NO_SUGGESTIONS: Place[] = [];
export function ScheduledRoutePicker({ pickup, destination, disabled, suggestions = NO_SUGGESTIONS, onChange, onPendingChange }: {
  pickup: Place | null; destination: Place | null; disabled: boolean; suggestions?: Place[];
  onChange: (field: Field, place: Place | null) => void; onPendingChange: (pending: boolean) => void;
}) {
  const [pin, setPin] = useState<Field | null>(null), [point, setPoint] = useState<GeoPoint>(PAID_RIDES_CONFIG.defaultCenter);
  const [moving, setMoving] = useState(false), [working, setWorking] = useState(false), [error, setError] = useState("");
  const [recenter, setRecenter] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const showMap = Boolean(pin) || previewOpen;
  const operation = useRef(0);
  useEffect(() => () => { operation.current += 1; }, []);
  useEffect(() => { onPendingChange(Boolean(pin) || working); }, [pin, working, onPendingChange]);
  const route = useQuery({
    queryKey: ["paid-rides", "scheduled-route", pickup?.point.lat, pickup?.point.lng, destination?.point.lat, destination?.point.lng],
    queryFn: ({ signal }) => getMapProvider().calculateRoute([pickup!.point, destination!.point], signal),
    enabled: Boolean(pickup && destination) && previewOpen && !pin, staleTime: 600_000, retry: false, refetchOnWindowFocus: false,
  });
  // Approximate fallback geometry is never drawn as a road route.
  const road = !pin && pickup && destination && route.data?.source === "road" ? route.data : null;
  const mapPoints = road?.points ?? [pickup?.point, destination?.point].filter((p): p is GeoPoint => Boolean(p));
  const camera = pin ? { kind: "point" as const, point, zoom: 16 } : mapPoints.length > 1 ? { kind: "fit" as const, points: mapPoints } : { kind: "point" as const, point: mapPoints[0] ?? PAID_RIDES_CONFIG.defaultCenter, zoom: mapPoints.length ? 15 : PAID_RIDES_CONFIG.defaultZoom };
  const cameraKey = pin ? `pin-${pin}` : `${pickup?.point.lat},${pickup?.point.lng}:${destination?.point.lat},${destination?.point.lng}:${road ? "road" : "stops"}`;
  function choosePin(field: Field) {
    if (!showMap) setMapReady(false);
    setError(""); setPoint((field === "pickup" ? pickup : destination)?.point ?? pickup?.point ?? PAID_RIDES_CONFIG.defaultCenter);
    setMoving(false); setPin(field); setRecenter((value) => value + 1);
  }
  async function confirmPin() {
    if (!pin || disabled || working || moving || !mapReady) return;
    const field = pin, token = ++operation.current;
    setWorking(true); setError("");
    try {
      const place = await getMapProvider().reverseGeocode(point);
      if (token !== operation.current) return;
      onChange(field, place); setPin(null);
    } catch (e) { if (token === operation.current) setError(scheduleError(e)); }
    finally { if (token === operation.current) setWorking(false); }
  }
  async function locate() {
    if (disabled || working) return;
    const token = ++operation.current; setWorking(true); setError("");
    try {
      if (!navigator.geolocation) throw new Error("Location isn't available. Search for your pickup or choose it on the map.");
      const fix = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 }));
      if (token !== operation.current) return;
      const place = await getMapProvider().reverseGeocode({ lat: fix.coords.latitude, lng: fix.coords.longitude });
      if (token !== operation.current) return;
      onChange("pickup", { ...place, name: "Current location", secondary: place.name === "Pinned location" ? place.secondary : place.name, source: "current-location" });
      setRecenter((value) => value + 1);
    } catch { if (token === operation.current) setError("We couldn't get your location. Allow location access, search for an address, or choose on the map."); }
    finally { if (token === operation.current) setWorking(false); }
  }
  return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <AddressField field="pickup" value={pickup} near={pickup?.point} disabled={disabled || working || !!pin} suggestions={suggestions} onChange={(place) => onChange("pickup", place)} onPin={() => choosePin("pickup")} onLocate={() => void locate()} />
      <AddressField field="destination" value={destination} near={pickup?.point} disabled={disabled || working || !!pin} suggestions={suggestions} onChange={(place) => onChange("destination", place)} onPin={() => choosePin("destination")} />
    </div>
    {!pin && pickup && destination ? <Button pill size="sm" variant="ghost" icon={MapPinned} disabled={disabled || working} aria-expanded={previewOpen} onClick={() => { if (!previewOpen) setMapReady(false); setPreviewOpen((open) => !open); }}>{previewOpen ? "Close route preview" : "Preview route"}</Button> : null}
    {showMap ? <div className="relative isolate h-72 overflow-hidden rounded-[var(--ride-radius-lg)] border border-line sm:h-80" role="region" aria-label={pin ? `Choose ${pin} on map` : "Scheduled trip route preview"}>
      <RideMap onReady={() => setMapReady(true)} failureMessage="The map could not load. Search for your pickup and destination above to keep planning your trip." route={road} pickup={pin === "pickup" ? null : pickup?.point} pickupLabel={pickup?.name} destination={pin === "destination" ? null : destination?.point} destinationLabel={destination?.name} camera={camera} cameraKey={cameraKey} recenterToken={recenter} insets={{ top: 0, right: 0, bottom: 0, left: 0 }} interactive={!disabled && !working}
        onCenterChange={pin ? (next, settled) => { setPoint(next); setMoving(!settled); } : undefined} />
      {pin ? <div className="pointer-events-none absolute inset-0 z-[600] flex items-center justify-center"><MapPin className={`size-10 -translate-y-1/2 fill-gold-500 text-forest-900 drop-shadow-lg ${moving ? "-mt-2" : ""}`} aria-hidden /></div> : null}
      <Button pill size="sm" variant="secondary" icon={Navigation} disabled={disabled || working || !mapReady} className="absolute right-3 top-3 z-[600]" onClick={() => setRecenter((value) => value + 1)}>Recenter</Button>
    </div> : null}
    {pin ? <div className="space-y-3 rounded-[var(--kx-radius-md)] bg-surface-nested p-4"><p className="ride-body-sm font-medium">Move the map to set your {pin}</p><p className="ride-caption">The pin marks the exact spot. Use the arrow keys, drag, or pinch to adjust the map.</p><div className="flex flex-wrap gap-2"><Button pill size="sm" disabled={disabled || moving || !mapReady} loading={working} loadingLabel="Confirming location" onClick={() => void confirmPin()}>Confirm {pin}</Button><Button pill size="sm" variant="ghost" icon={X} disabled={disabled || working} onClick={() => setPin(null)}>Cancel</Button></div></div> : null}
    {working && !pin ? <p role="status" className="ride-caption">Finding your pickup location…</p> : null}
    {error ? <p role="alert" className="ride-body-sm text-danger-600">{error}</p> : null}
    {previewOpen && !pin && pickup && destination ? route.isFetching ? <p role="status" className="ride-caption">Finding a road route…</p> : road ? <MetricRow items={[{ label: "Distance", value: formatDistance(road.distanceMeters) }, { label: "Estimated journey", value: formatDuration(road.durationSeconds) }]} /> : <div role="status" className="ride-caption"><p>The road preview is unavailable. Your selected locations are saved; you can still get a fare quote.</p><Button pill size="sm" variant="ghost" disabled={route.isFetching} onClick={() => void route.refetch()}>Retry route preview</Button></div> : null}
  </div>;
}
