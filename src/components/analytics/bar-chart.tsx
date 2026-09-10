"use client";

import { useId, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

export interface BarDatum {
  label: string;
  value: number;
  /** Optional comparison series, drawn beside the primary bar. */
  secondary?: number;
}

/**
 * A single-series bar chart.
 *
 * Values are labelled on hover and focus, and the whole series is also exposed
 * as a table for screen readers — the shape is a convenience, not the only way
 * to read the data.
 */
export function BarChart({
  data,
  formatValue,
  accent = "lilac",
  height = 160,
  caption,
  seriesLabels,
  className,
}: {
  data: BarDatum[];
  formatValue: (value: number) => string;
  accent?: "lilac" | "gold" | "forest";
  height?: number;
  caption: string;
  /** Legend for the primary and, where present, the comparison series. */
  seriesLabels?: [string, string?];
  className?: string;
}) {
  const { prefersReduced } = useReducedMotionSafe();
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();

  const hasSecondary = data.some((d) => d.secondary !== undefined);
  const max = Math.max(
    ...data.map((d) => Math.max(d.value, d.secondary ?? 0)),
    1,
  );

  const fill =
    accent === "gold"
      ? "bg-gold-500"
      : accent === "forest"
        ? "bg-forest-500"
        : "bg-lilac-600";

  return (
    <figure className={cn("", className)}>
      <div
        className="flex items-end gap-2"
        style={{ height }}
        role="img"
        aria-describedby={tableId}
        aria-label={caption}
      >
        {data.map((datum, index) => {
          const ratio = datum.value / max;
          const isActive = active === index;

          return (
            <button
              key={datum.label}
              type="button"
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              aria-label={`${datum.label}: ${formatValue(datum.value)}${
                datum.secondary !== undefined
                  ? `, ${formatValue(datum.secondary)}`
                  : ""
              }`}
              className="group relative flex h-full flex-1 flex-col justify-end rounded-t-[var(--kx-radius-xs)]"
            >
              {/* Value label on hover/focus */}
              <span
                className={cn(
                  "type-numeric pointer-events-none absolute inset-x-0 -top-1 text-center text-[0.75rem] font-semibold text-ink transition-opacity duration-[165ms]",
                  isActive ? "opacity-100" : "opacity-0",
                )}
              >
                {formatValue(datum.value)}
              </span>

              <span className="flex h-full w-full items-end justify-center gap-[3px]">
                <motion.span
                  className={cn(
                    "block w-full rounded-t-[var(--kx-radius-xs)] transition-opacity duration-[165ms]",
                    fill,
                    isActive ? "opacity-100" : "opacity-80",
                  )}
                  initial={{ height: prefersReduced ? `${ratio * 100}%` : 0 }}
                  whileInView={{ height: `${Math.max(ratio * 100, 2)}%` }}
                  viewport={{ once: true }}
                  transition={{
                    duration: prefersReduced ? 0 : 0.6,
                    delay: prefersReduced ? 0 : index * 0.05,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                />

                {datum.secondary !== undefined ? (
                  <motion.span
                    className={cn(
                      "block w-full rounded-t-[var(--kx-radius-xs)] bg-[color-mix(in_srgb,var(--kx-text)_18%,transparent)] transition-opacity duration-[165ms]",
                      isActive ? "opacity-100" : "opacity-80",
                    )}
                    initial={{
                      height: prefersReduced
                        ? `${(datum.secondary / max) * 100}%`
                        : 0,
                    }}
                    whileInView={{
                      height: `${Math.max((datum.secondary / max) * 100, 2)}%`,
                    }}
                    viewport={{ once: true }}
                    transition={{
                      duration: prefersReduced ? 0 : 0.6,
                      delay: prefersReduced ? 0 : index * 0.05 + 0.05,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex gap-2">
        {data.map((datum, index) => (
          <span
            key={datum.label}
            className={cn(
              "type-micro flex-1 text-center transition-colors",
              active === index ? "text-ink" : "text-ink-muted",
            )}
          >
            {datum.label}
          </span>
        ))}
      </div>

      {seriesLabels ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="type-meta inline-flex items-center gap-1.5 text-ink-secondary">
            <span className={cn("size-2.5 rounded-full", fill)} aria-hidden />
            {seriesLabels[0]}
          </span>
          {hasSecondary && seriesLabels[1] ? (
            <span className="type-meta inline-flex items-center gap-1.5 text-ink-secondary">
              <span
                className="size-2.5 rounded-full bg-[color-mix(in_srgb,var(--kx-text)_18%,transparent)]"
                aria-hidden
              />
              {seriesLabels[1]}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* The same numbers, readable without the chart */}
      <table id={tableId} className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.label}>
              <th scope="row">{datum.label}</th>
              <td>{formatValue(datum.value)}</td>
              {datum.secondary !== undefined ? (
                <td>{formatValue(datum.secondary)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
