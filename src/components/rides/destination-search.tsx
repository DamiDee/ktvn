"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { transitions } from "@/lib/motion";
import { queryKeys } from "@/constants/query-keys";
import { rideService } from "@/services";
import { RECENT_DESTINATIONS, SUGGESTED_DESTINATIONS } from "@/mocks/locations";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { RideLocation } from "@/types/models";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Apple Maps-style destination search.
 *
 * Collapsed it is a single large field; focused, a panel expands with recent
 * and suggested destinations, then live results. Fully keyboard-navigable —
 * arrows move the active option, Enter selects, Escape closes.
 */
export function DestinationSearch({
  value,
  onSelect,
  onClear,
  placeholder = "Where are you going?",
  autoFocus = false,
  className,
}: {
  value: RideLocation | null;
  onSelect: (location: RideLocation) => void;
  onClear?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const debouncedQuery = useDebouncedValue(query);
  const searching = debouncedQuery.trim().length > 0;

  const { data: results, isFetching } = useQuery({
    queryKey: queryKeys.locations.search(debouncedQuery),
    queryFn: () => rideService.searchDestinations(debouncedQuery),
    enabled: open && searching,
  });

  // Which list is on screen right now.
  const groups: { heading: string; icon: typeof Clock; items: RideLocation[] }[] =
    searching
      ? [{ heading: "Results", icon: Search, items: results ?? [] }]
      : [
          { heading: "Recent", icon: Clock, items: RECENT_DESTINATIONS },
          { heading: "Suggested", icon: Sparkles, items: SUGGESTED_DESTINATIONS },
        ];

  const flatItems = groups.flatMap((group) => group.items);

  // Reset the highlighted option whenever the list changes underneath it.
  // Adjusting state during render (rather than in an effect) avoids the extra
  // render pass and the flash of a stale highlight.
  const listKey = `${debouncedQuery}|${open}`;
  const [prevListKey, setPrevListKey] = useState(listKey);
  if (prevListKey !== listKey) {
    setPrevListKey(listKey);
    setActiveIndex(0);
  }

  // Close on outside click.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Pure state work only — dismissing focus is done by the caller, so this
  // stays free of ref access.
  const choose = useCallback(
    (location: RideLocation) => {
      onSelect(location);
      setQuery("");
      setOpen(false);
    },
    [onSelect],
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(flatItems.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      const target = flatItems[activeIndex];
      if (target) {
        event.preventDefault();
        choose(target);
        inputRef.current?.blur();
      }
    }
  }

  // Running index across groups, so keyboard order matches visual order.
  let renderIndex = -1;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "relative flex items-center rounded-[var(--kx-radius-lg)] border bg-surface transition-[border-color,box-shadow] duration-[165ms]",
          open
            ? "border-forest-500 ring-4 ring-forest-500/10 dark:border-gold-500 dark:ring-gold-500/12"
            : "border-line-strong",
        )}
      >
        <MapPin
          className="pointer-events-none absolute left-4 size-[1.15rem] text-ink-muted"
          strokeWidth={1.8}
          aria-hidden
        />

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && flatItems[activeIndex]
              ? `${listboxId}-${flatItems[activeIndex].id}`
              : undefined
          }
          autoFocus={autoFocus}
          placeholder={value ? value.label : placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            "h-14 w-full bg-transparent pr-11 pl-11.5 text-[1rem] text-ink outline-none",
            value && !query
              ? "placeholder:font-medium placeholder:text-ink"
              : "placeholder:text-ink-muted",
          )}
        />

        {(value || query) && onClear ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onClear();
              inputRef.current?.focus();
            }}
            aria-label="Clear destination"
            className="kx-tap absolute right-3 inline-flex size-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-[color-mix(in_srgb,var(--kx-text)_8%,transparent)] hover:text-ink"
          >
            <X className="size-3.5" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={transitions.card}
            className="absolute inset-x-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-[var(--kx-radius-lg)] border border-line bg-surface shadow-xl"
          >
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Destinations"
              className="kx-scroll-thin max-h-80 overflow-y-auto py-2"
            >
              {isFetching && searching ? (
                <li className="space-y-3 px-4 py-3">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Skeleton className="size-8 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-28 rounded-full" />
                        <Skeleton className="h-3 w-44 rounded-full" />
                      </div>
                    </div>
                  ))}
                </li>
              ) : flatItems.length === 0 ? (
                <li className="px-4 py-8 text-center">
                  <p className="type-body font-medium text-ink">
                    No places match &ldquo;{debouncedQuery}&rdquo;.
                  </p>
                  <p className="type-meta mt-1 text-ink-secondary">
                    Try an area name like Gwarinpa or Wuse II.
                  </p>
                </li>
              ) : (
                groups.map((group) =>
                  group.items.length === 0 ? null : (
                    <li key={group.heading}>
                      <p className="type-micro flex items-center gap-1.5 px-4 pt-2 pb-1.5 text-ink-muted">
                        <group.icon className="size-3" strokeWidth={2} aria-hidden />
                        {group.heading}
                      </p>
                      <ul>
                        {group.items.map((item) => {
                          renderIndex += 1;
                          const active = renderIndex === activeIndex;

                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                id={`${listboxId}-${item.id}`}
                                role="option"
                                aria-selected={active}
                                onMouseEnter={() => setActiveIndex(renderIndex)}
                                onClick={() => {
                                  choose(item);
                                  inputRef.current?.blur();
                                }}
                                className={cn(
                                  "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                                  active ? "bg-surface-nested" : "bg-transparent",
                                )}
                              >
                                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-nested text-ink-muted ring-1 ring-line">
                                  <MapPin className="size-4" strokeWidth={1.8} aria-hidden />
                                </span>
                                <span className="min-w-0">
                                  <span className="type-body block truncate font-medium text-ink">
                                    {item.label}
                                  </span>
                                  <span className="type-meta block truncate text-ink-muted">
                                    {item.address}
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ),
                )
              )}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
