"use client";

import { useId } from "react";
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { transitions } from "@/lib/motion";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Short supporting line, e.g. "No payment required". */
  description?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  size?: "sm" | "md" | "lg";
  tone?: "forest" | "gold";
  className?: string;
}

const SIZES = {
  sm: { track: "h-9 p-1", item: "text-[0.8125rem] gap-1.5", icon: "size-3.5" },
  md: { track: "h-11 p-1", item: "text-[0.875rem] gap-2", icon: "size-4" },
  lg: { track: "h-13 p-1.5", item: "text-[0.9375rem] gap-2", icon: "size-[1.05rem]" },
} as const;

/**
 * iOS-style segmented control. The selected background is a shared layout
 * element, so it glides between options rather than snapping.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  tone = "gold",
  className,
}: SegmentedControlProps<T>) {
  const layoutId = useId();
  const config = SIZES[size];

  const selectedBg =
    tone === "gold"
      ? "bg-gold-500"
      : "bg-forest-800 dark:bg-forest-500";
  const selectedText =
    tone === "gold" ? "text-forest-950" : "text-white";

  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();

    const direction = event.key === "ArrowRight" ? 1 : -1;
    for (let step = 1; step <= options.length; step += 1) {
      const next = options[(index + direction * step + options.length * step) % options.length];
      if (next && !next.disabled) {
        onChange(next.value);
        break;
      }
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "relative inline-grid w-full rounded-full bg-surface-nested ring-1 ring-inset ring-line",
        config.track,
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "relative z-10 inline-flex items-center justify-center rounded-full font-medium",
              "transition-colors duration-[165ms] disabled:cursor-not-allowed disabled:opacity-40",
              config.item,
              selected ? selectedText : "text-ink-secondary hover:text-ink",
            )}
          >
            {selected ? (
              <motion.span
                layoutId={layoutId}
                className={cn("absolute inset-0 rounded-full shadow-sm", selectedBg)}
                transition={transitions.springSnappy}
                aria-hidden
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-[inherit]">
              {Icon ? <Icon className={config.icon} strokeWidth={1.9} aria-hidden /> : null}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Larger card-style choice for track selection during onboarding. */
export function ChoiceCards<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: (SegmentOption<T> & { detail?: string })[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-3 sm:grid-cols-2", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "group relative overflow-hidden rounded-[var(--kx-radius-lg)] border p-5 text-left",
              "transition-[border-color,box-shadow,transform] duration-[250ms] ease-[var(--kx-ease-standard)]",
              "hover:-translate-y-0.5 hover:shadow-md",
              selected
                ? "border-gold-500 bg-gold-50/60 shadow-gold dark:bg-gold-500/10"
                : "border-line bg-surface hover:border-line-strong",
            )}
          >
            {selected ? (
              <motion.span
                layoutId={`choice-glow-${label}`}
                className="pointer-events-none absolute inset-0 rounded-[var(--kx-radius-lg)] ring-2 ring-gold-500/60 ring-inset"
                transition={transitions.springGentle}
                aria-hidden
              />
            ) : null}

            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                {Icon ? (
                  <Icon
                    className={cn(
                      "mb-3 size-5",
                      selected ? "text-gold-600 dark:text-gold-400" : "text-ink-muted",
                    )}
                    strokeWidth={1.7}
                    aria-hidden
                  />
                ) : null}
                <p className="type-card-title text-ink">{option.label}</p>
                {option.description ? (
                  <p className="type-meta mt-1 text-ink-secondary">
                    {option.description}
                  </p>
                ) : null}
                {option.detail ? (
                  <p className="type-meta mt-2 text-ink-muted">{option.detail}</p>
                ) : null}
              </div>

              <span
                className={cn(
                  "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  selected
                    ? "border-gold-500 bg-gold-500"
                    : "border-line-strong bg-transparent",
                )}
                aria-hidden
              >
                {selected ? (
                  <svg viewBox="0 0 16 16" className="size-3 text-forest-950" fill="none">
                    <path
                      d="M3.5 8.5 6.5 11.5 12.5 5"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
