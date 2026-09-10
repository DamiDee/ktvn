"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { transitions } from "@/lib/motion";

export interface RatingProps {
  value: number;
  onChange?: (value: 1 | 2 | 3 | 4 | 5) => void;
  size?: "sm" | "md" | "lg";
  /** Read-only display with the numeric value beside the star. */
  compact?: boolean;
  label?: string;
  className?: string;
}

const STAR_SIZES = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-9",
} as const;

/** Compact read-only form: ★ 4.9 */
export function RatingValue({
  value,
  size = "sm",
  className,
}: {
  value: number;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium text-ink-secondary type-numeric",
        size === "sm" ? "text-[0.8125rem]" : "text-[0.9375rem]",
        className,
      )}
    >
      <Star
        className={cn(size === "sm" ? "size-3.5" : "size-4", "fill-gold-500 text-gold-500")}
        strokeWidth={1.5}
        aria-hidden
      />
      {value.toFixed(1)}
      <span className="sr-only">out of 5</span>
    </span>
  );
}

/** Interactive rating. Stars illuminate progressively as you move across. */
export function Rating({
  value,
  onChange,
  size = "lg",
  compact = false,
  label = "Rate this ride",
  className,
}: RatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const interactive = Boolean(onChange);
  const displayValue = hovered ?? value;

  if (compact || !interactive) {
    return <RatingValue value={value} className={className} />;
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex items-center gap-2", className)}
      onMouseLeave={() => setHovered(null)}
    >
      {([1, 2, 3, 4, 5] as const).map((star) => {
        const filled = star <= displayValue;

        return (
          <motion.button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
            onMouseEnter={() => setHovered(star)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(null)}
            onClick={() => onChange?.(star)}
            animate={{ scale: filled ? 1 : 0.94 }}
            transition={{ ...transitions.springSnappy, delay: filled ? star * 0.028 : 0 }}
            className="rounded-full p-1"
          >
            <Star
              className={cn(
                STAR_SIZES[size],
                "transition-colors duration-[165ms]",
                filled
                  ? "fill-gold-500 text-gold-500"
                  : "fill-transparent text-[color-mix(in_srgb,var(--kx-text)_22%,transparent)]",
              )}
              strokeWidth={1.5}
              aria-hidden
            />
          </motion.button>
        );
      })}
    </div>
  );
}
