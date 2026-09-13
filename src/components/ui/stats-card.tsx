"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView } from "motion/react";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

/** Counts up to `value` once the card scrolls into view. */
export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  durationMs = 900,
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const { prefersReduced } = useReducedMotionSafe();
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    // Under reduced motion, or before the card scrolls into view, the value is
    // derived below rather than written to state — no setState in the effect body.
    if (!inView || prefersReduced) return;

    let frame = 0;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      // Ease-out cubic.
      const eased = 1 - (1 - progress) ** 3;
      setAnimated(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, durationMs, prefersReduced]);

  const display = prefersReduced ? value : inView ? animated : 0;

  return (
    <span ref={ref} className={cn("type-numeric", className)}>
      {prefix}
      {display.toLocaleString("en-NG", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

export interface StatsCardProps {
  label: string;
  value: ReactNode;
  /** Numeric value for the count-up animation; omit to render `value` as-is. */
  numericValue?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  deltaPercent?: number;
  hint?: ReactNode;
  icon?: LucideIcon;
  accent?: "neutral" | "gold" | "lilac" | "forest";
  sparkline?: number[];
  className?: string;
}

const ACCENT_ICON: Record<NonNullable<StatsCardProps["accent"]>, string> = {
  neutral: "bg-surface-nested text-ink-muted",
  gold: "bg-gold-50 text-gold-700 dark:bg-gold-500/14 dark:text-gold-300",
  lilac: "bg-lilac-50 text-lilac-700 dark:bg-lilac-500/14 dark:text-lilac-200",
  forest: "bg-forest-50 text-forest-700 dark:bg-forest-500/16 dark:text-forest-200",
};

export function StatsCard({
  label,
  value,
  numericValue,
  decimals = 0,
  prefix,
  suffix,
  deltaPercent,
  hint,
  icon: Icon,
  accent = "neutral",
  sparkline,
  className,
}: StatsCardProps) {
  const positive = (deltaPercent ?? 0) > 0;
  const negative = (deltaPercent ?? 0) < 0;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[var(--kx-radius-lg)] border border-line bg-surface p-5",
        "transition-[transform,box-shadow,border-color] duration-[250ms] ease-[var(--kx-ease-standard)]",
        "hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="type-micro text-ink-muted">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-[var(--kx-radius-xs)]",
              ACCENT_ICON[accent],
            )}
          >
            <Icon className="size-4" strokeWidth={1.8} aria-hidden />
          </span>
        ) : null}
      </div>

      <p className="kx-stat-value mt-2.5 text-[1.75rem] leading-none font-semibold tracking-[-0.03em] text-ink">
        {numericValue !== undefined ? (
          <CountUp
            value={numericValue}
            decimals={decimals}
            prefix={prefix}
            suffix={suffix}
          />
        ) : (
          value
        )}
      </p>

      <div className="mt-3 flex items-center gap-2">
        {deltaPercent !== undefined && deltaPercent !== 0 ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[0.75rem] font-medium type-numeric",
              positive
                ? "text-success-500"
                : negative
                  ? "text-danger-500"
                  : "text-ink-muted",
            )}
          >
            {positive ? (
              <ArrowUpRight className="size-3.5" strokeWidth={2.2} aria-hidden />
            ) : (
              <ArrowDownRight className="size-3.5" strokeWidth={2.2} aria-hidden />
            )}
            {Math.abs(deltaPercent).toFixed(1)}%
          </span>
        ) : null}
        {hint ? <span className="type-meta text-ink-muted">{hint}</span> : null}
      </div>

      {sparkline && sparkline.length > 1 ? (
        <Sparkline values={sparkline} accent={accent} className="mt-4" />
      ) : null}
    </div>
  );
}

export function Sparkline({
  values,
  accent = "neutral",
  className,
}: {
  values: number[];
  accent?: NonNullable<StatsCardProps["accent"]>;
  className?: string;
}) {
  const { prefersReduced } = useReducedMotionSafe();
  const width = 100;
  const height = 28;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((value, index) => ({
    x: (index / (values.length - 1)) * width,
    y: height - ((value - min) / range) * height,
  }));

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const stroke =
    accent === "gold"
      ? "var(--kx-gold-500)"
      : accent === "lilac"
        ? "var(--kx-lilac-600)"
        : accent === "forest"
          ? "var(--kx-forest-500)"
          : "var(--kx-neutral-400)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-7 w-full", className)}
      aria-hidden
    >
      <motion.path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: prefersReduced ? 1 : 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: prefersReduced ? 0 : 0.85, ease: "easeOut" }}
      />
    </svg>
  );
}
