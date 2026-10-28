"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft, Clock3, LocateFixed, MapPin, MapPinned, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useIsDesktop } from "@/hooks/use-media-query";
import { PAID_RIDES_CONFIG } from "../config";
import { trackRideEvent } from "../analytics";
import { ERROR_COPY, toRideError } from "../domain/errors";
import type { PlaceSuggestion } from "../domain/types";
import { resolvePlaceSelection } from "../maps/resolve-place";
import { PlaceAttribution } from "../components/place-attribution";
import { useLocationStore } from "../location/location-store";
import { getMapProvider } from "../services";
import { usePassengerStore } from "../state/passenger-store";
import { usePreferencesStore } from "../state/preferences-store";
import { useHideRideNav } from "../shell/ride-module-shell";

/**
 * Full-screen place search for pickup and destination.
 *
 * Debounced, cancellable (TanStack passes an AbortSignal, so a stale request
 * is dropped as soon as the query changes), biased to the rider's area, and
 * fully operable from the keyboard as a combobox. Recent places and "current
 * location" appear before anything is typed.
 */

type Field = "pickup" | "destination";

export function LocationSearchPanel() {
  const draft = usePassengerStore((store) => store.draft);
  const setDraft = usePassengerStore((store) => store.setDraft);
  const choosePlace = usePassengerStore((store) => store.choosePlace);
  const clearPlace = usePassengerStore((store) => store.clearPlace);
  const backToBooking = usePassengerStore((store) => store.backToBooking);
  const locationRequest = useRef(0);
  useEffect(() => () => { locationRequest.current += 1; }, []);
  const recentPlaces = usePreferencesStore((state) => state.recentPlaces);
  const fix = useLocationStore((state) => state.fix);
  const requestLocation = useLocationStore((state) => state.request);
  const locationStatus = useLocationStore((state) => state.status);
  const desktop = useIsDesktop();
  useHideRideNav(true);

  const field: Field = draft.field;
  const [queries, setQueries] = useState<Record<Field, string>>(() => ({
    pickup: draft.pickup?.source === "current-location" ? "" : (draft.pickup?.name ?? ""),
    destination: draft.destination?.name ?? "",
  }));
  const query = queries[field];
  const debounced = useDebouncedValue(query.trim(), PAID_RIDES_CONFIG.searchDebounceMs);
  const [active, setActive] = useState(-1);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const inputs = { pickup: useRef<HTMLInputElement>(null), destination: useRef<HTMLInputElement>(null) };
  const listId = useId();
  const near = fix?.point ?? draft.pickup?.point;

  useEffect(() => {
    inputs[field].current?.focus();
    // Focus follows the field the rider is editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field]);

  useEffect(() => {
    trackRideEvent("destination_search_started");
  }, []);

  const searching = debounced.length >= PAID_RIDES_CONFIG.searchMinChars;
  const results = useQuery({
    queryKey: ["paid-rides", "places", debounced, near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : "none"],
    queryFn: ({ signal }) => getMapProvider().searchPlaces(debounced, { near, signal }),
    enabled: searching,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const typingAhead = query.trim() !== debounced;
  const places: PlaceSuggestion[] = searching ? (typingAhead ? [] : results.data ?? []) : recentPlaces;

  function close() {
    locationRequest.current += 1;
    backToBooking();
  }

  async function select(suggestion: PlaceSuggestion) {
    const request = ++locationRequest.current;
    setLocating(true); setLocateError(null);
    try {
      const place = await resolvePlaceSelection(getMapProvider(), suggestion);
      if (request !== locationRequest.current) return;
      setQueries((current) => ({ ...current, [field]: place.name }));
      setActive(-1); choosePlace(field, place);
    } catch { if (request === locationRequest.current) setLocateError("This place could not be confirmed. Try again or choose it on the map."); }
    finally { if (request === locationRequest.current) setLocating(false); }
  }

  async function useCurrentLocation() {
    const request = ++locationRequest.current;
    setLocating(true);
    setLocateError(null);
    const current = fix ?? (await requestLocation());
    if (request !== locationRequest.current) return;
    if (!current) {
      setLocating(false);
      setLocateError(
        useLocationStore.getState().status === "denied"
          ? "Location is blocked for this site. Allow it in your browser settings, or search for your pickup."
          : "We couldn't get a location fix. Try again, or search for the address.",
      );
      return;
    }
    try {
      const place = await getMapProvider().reverseGeocode(current.point);
      if (request !== locationRequest.current) return;
      setLocating(false);
      void select({ ...place, name: field === "pickup" ? "Current location" : place.name, secondary: place.name === "Pinned location" ? place.secondary : place.name, source: "current-location" });
    } catch {
      if (request !== locationRequest.current) return;
      setLocating(false);
      setLocateError("We couldn't confirm this address. Try again, search for a place, or choose it on the map.");
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, places.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, -1));
    } else if (event.key === "Enter" && active >= 0 && places[active]) {
      event.preventDefault();
      select(places[active]);
    } else if (event.key === "Escape") {
      close();
    }
  }

  const fieldInput = (name: Field) => {
    const isActive = field === name;
    return (
      <div
        className={cn(
          "relative flex h-12 items-center rounded-[var(--ride-radius-md)] transition-colors",
          isActive ? "bg-[var(--surface-secondary)] ring-2 ring-[var(--ride-primary)]" : "bg-[var(--surface-secondary)]",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "ml-3.5 size-2.5 shrink-0",
            name === "pickup" ? "rounded-full border-[2.5px] border-[var(--ride-marker-pickup)]" : "rounded-[3px] bg-[var(--ride-marker-destination)]",
          )}
        />
        <input
          ref={inputs[name]}
          value={queries[name]}
          onChange={(event) => {
            locationRequest.current += 1;
            setLocating(false);
            if (draft[name] && event.target.value !== draft[name]?.name) clearPlace(name);
            setQueries((current) => ({ ...current, [name]: event.target.value }));
            setActive(-1);
          }}
          onFocus={() => {
            if (draft.field !== name) {
              locationRequest.current += 1;
              setLocating(false);
              setDraft({ field: name });
            }
          }}
          onKeyDown={onKeyDown}
          placeholder={name === "pickup" ? (draft.pickup?.source === "current-location" ? "Current location" : "Pickup location") : "Where are you going?"}
          aria-label={name === "pickup" ? "Pickup location" : "Destination"}
          role="combobox"
          aria-expanded={isActive && places.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={isActive && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[1rem] font-medium text-[var(--text-primary)] placeholder:font-normal placeholder:text-[var(--text-tertiary)] focus:outline-none"
        />
        {isActive && (typingAhead || results.isFetching) && searching ? (
          <span className="mr-3 flex gap-0.5" aria-hidden>
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="ride-typing-dot size-1.5 rounded-full bg-[var(--text-tertiary)]" style={{ animationDelay: `${dot * 0.15}s` }} />
            ))}
          </span>
        ) : queries[name] ? (
          <button
            type="button"
            onClick={() => {
              locationRequest.current += 1;
              setLocating(false);
              clearPlace(name);
              setQueries((current) => ({ ...current, [name]: "" }));
              inputs[name].current?.focus();
            }}
            aria-label={`Clear ${name === "pickup" ? "pickup" : "destination"}`}
            className="kx-tap mr-2 rounded-full p-1.5 text-[var(--text-tertiary)]"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: desktop ? 0 : 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className={cn(
        "absolute z-50 flex flex-col bg-[var(--surface-primary)]",
        desktop ? "top-4 bottom-4 left-4 w-[25rem] overflow-hidden rounded-[var(--ride-radius-xl)] shadow-[var(--ride-elev-4)]" : "inset-0",
      )}
      role="dialog"
      aria-modal={!desktop || undefined}
      aria-label={field === "pickup" ? "Choose pickup" : "Choose destination"}
    >
      <div className="shrink-0 px-4 pb-3" style={{ paddingTop: desktop ? 20 : "calc(var(--ride-safe-top) + 12px)" }}>
        <div className="mb-3 flex items-center gap-2">
          <button type="button" onClick={close} aria-label="Back" className="ride-press -ml-1 flex size-11 items-center justify-center rounded-full hover:bg-[var(--surface-secondary)]">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <h2 className="ride-heading-md">{field === "pickup" ? "Set pickup" : "Plan your ride"}</h2>
        </div>
        <div className="space-y-2">
          {fieldInput("pickup")}
          {fieldInput("destination")}
        </div>
      </div>

      <div className="kx-scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[calc(var(--ride-safe-bottom)+16px)]">
        {locating ? <p role="status" className="ride-caption px-4 py-2">Confirming location…</p> : null}
        {searching && locateError ? <p role="alert" className="px-4 py-2 text-sm text-danger-600">{locateError}</p> : null}
        {!searching ? (
          <div className="px-2 pt-1">
            <ShortcutRow
              icon={LocateFixed}
              title={locating ? "Finding you…" : "Use current location"}
              subtitle={locationStatus === "denied" ? "Location access is blocked" : fix ? "Uses your device's GPS" : "We'll ask for permission"}
              onClick={useCurrentLocation}
              disabled={locating}
            />
            <ShortcutRow icon={MapPinned} title="Choose on map" subtitle="Move the map to place the pin" onClick={() => { locationRequest.current += 1; setLocating(false); setDraft({ step: "pickup-pin" }); }} />
            {locateError ? (
              <p role="alert" className="ride-body-sm mx-2 mt-1 rounded-[var(--ride-radius-sm)] bg-[var(--kx-pending-50)] px-3 py-2.5 text-[var(--kx-pending-700)] dark:bg-[color-mix(in_srgb,var(--kx-pending-500)_14%,transparent)] dark:text-[var(--kx-gold-200)]">
                {locateError}
              </p>
            ) : null}
            {recentPlaces.length ? <p className="ride-label mt-5 mb-1 px-2">Recent</p> : null}
          </div>
        ) : null}

        {searching && results.isPending && !results.data ? (
          <div className="space-y-1 px-2 pt-2" aria-hidden>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-3.5 px-2 py-3">
                <div className="kx-skeleton size-9 !rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="kx-skeleton h-3.5 w-1/2" />
                  <div className="kx-skeleton h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {searching && results.isError ? (
          <div className="px-4 py-8 text-center" role="alert">
            <p className="ride-body font-semibold">Search isn&apos;t responding</p>
            <p className="ride-body-sm mt-1 text-[var(--text-secondary)]">{ERROR_COPY[toRideError(results.error).code].body}</p>
            <button type="button" onClick={() => void results.refetch()} className="ride-press mt-4 h-11 rounded-full bg-[var(--surface-secondary)] px-5 font-semibold">
              Try again
            </button>
          </div>
        ) : null}

        {searching && results.isSuccess && places.length === 0 && !typingAhead ? (
          <div className="px-4 py-10 text-center">
            <Search className="mx-auto size-7 text-[var(--text-tertiary)]" aria-hidden />
            <p className="ride-body mt-3 font-semibold">No places match &ldquo;{debounced}&rdquo;</p>
            <p className="ride-body-sm mt-1 text-[var(--text-secondary)]">Check the spelling, add the area name, or choose the spot on the map.</p>
          </div>
        ) : null}

        <ul id={listId} role="listbox" aria-label={searching ? "Search results" : "Recent places"} className="px-1">
          {places.map((place, index) => (
            <li
              key={`${place.id}-${index}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onClick={() => select(place)}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "ride-press flex cursor-pointer items-center gap-3.5 rounded-[var(--ride-radius-md)] px-3 py-3",
                index === active ? "bg-[var(--surface-secondary)]" : "hover:bg-[var(--surface-secondary)]",
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
                {place.source === "recent" ? <Clock3 className="size-4" aria-hidden /> : <MapPin className="size-4" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="ride-body block truncate font-medium">{place.name}</span>
                {place.secondary ? <span className="ride-caption block truncate">{place.secondary}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        {searching && places.length > 0 ? (
          <PlaceAttribution />
        ) : null}
      </div>
    </motion.div>
  );
}

function ShortcutRow({ icon: Icon, title, subtitle, onClick, disabled }: { icon: typeof MapPin; title: string; subtitle: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ride-press flex w-full items-center gap-3.5 rounded-[var(--ride-radius-md)] px-2 py-3 text-left hover:bg-[var(--surface-secondary)] disabled:opacity-60"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--ride-brand-soft)] text-[var(--kx-forest-700)] dark:text-[var(--kx-gold-300)]">
        <Icon className="size-[1.05rem]" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="ride-body block font-medium">{title}</span>
        <span className="ride-caption block">{subtitle}</span>
      </span>
    </button>
  );
}
