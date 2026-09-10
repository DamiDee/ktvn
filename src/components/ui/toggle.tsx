"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { transitions } from "@/lib/motion";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: ReactNode;
  /** Hides the visible label, keeping it for screen readers. */
  hideLabel?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  tone?: "forest" | "gold" | "success";
  className?: string;
}

const TRACK = {
  sm: "h-6 w-10 p-0.5",
  md: "h-7 w-12 p-0.5",
} as const;

const THUMB = {
  sm: "size-5",
  md: "size-6",
} as const;

export function Toggle({
  checked,
  onChange,
  label,
  description,
  hideLabel = false,
  disabled = false,
  size = "md",
  tone = "forest",
  className,
}: ToggleProps) {
  const onColour =
    tone === "gold"
      ? "bg-gold-500"
      : tone === "success"
        ? "bg-success-500"
        : "bg-forest-700 dark:bg-forest-500";

  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={hideLabel ? label : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "kx-tap relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors duration-[165ms]",
        "disabled:cursor-not-allowed disabled:opacity-45",
        TRACK[size],
        checked ? onColour : "bg-[color-mix(in_srgb,var(--kx-text)_16%,transparent)]",
      )}
    >
      <motion.span
        layout
        transition={transitions.springSnappy}
        className={cn(
          "rounded-full bg-white shadow-sm",
          THUMB[size],
          checked ? "ml-auto" : "mr-auto",
        )}
      />
    </button>
  );

  if (hideLabel) return <span className={className}>{control}</span>;

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <p className="text-[0.9375rem] font-medium text-ink">{label}</p>
        {description ? (
          <p className="type-meta mt-0.5 text-ink-secondary">{description}</p>
        ) : null}
      </div>
      {control}
    </div>
  );
}
