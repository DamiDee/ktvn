"use client";

import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { transitions } from "@/lib/motion";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/**
 * Filter pills.
 *
 * The row scrolls horizontally inside its own container on phones — the page
 * itself never scrolls sideways — and the pills stay 44px tall so they're
 * comfortable to tap.
 */
export function FilterBar<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const layoutId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "kx-no-scrollbar -mx-4 flex snap-x items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative inline-flex h-11 shrink-0 snap-start items-center gap-2 rounded-full px-4 text-[0.875rem] font-medium whitespace-nowrap transition-colors",
              selected
                ? "text-white dark:text-forest-950"
                : "bg-surface text-ink-secondary ring-1 ring-inset ring-line hover:text-ink",
            )}
          >
            {selected ? (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-forest-800 dark:bg-gold-500"
                transition={transitions.springSnappy}
                aria-hidden
              />
            ) : null}
            <span className="relative z-10">{option.label}</span>
            {option.count !== undefined ? (
              <span
                className={cn(
                  "type-numeric relative z-10 rounded-full px-1.5 py-0.5 text-[0.6875rem]",
                  selected
                    ? "bg-white/20 dark:bg-forest-950/15"
                    : "bg-surface-nested",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Search field sized for thumbs, with a clear button when it has a value. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
}) {
  const inputId = useId();

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted"
        strokeWidth={1.9}
        aria-hidden
      />
      <input
        id={inputId}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-11 w-full rounded-full border border-line-strong bg-surface pr-10 pl-10 text-[0.9375rem] text-ink outline-none",
          "placeholder:text-ink-muted",
          "focus:border-forest-500 focus:ring-4 focus:ring-forest-500/10 dark:focus:border-gold-500 dark:focus:ring-gold-500/12",
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-[color-mix(in_srgb,var(--kx-text)_8%,transparent)] hover:text-ink"
        >
          <X className="size-4" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Header row that stacks on phones: search above, filters below. */
export function ListControls({
  search,
  filters,
  className,
}: {
  search?: ReactNode;
  filters?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {search}
      {filters}
    </div>
  );
}
