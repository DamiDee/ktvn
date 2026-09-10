"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { transitions } from "@/lib/motion";

export interface ProgressBarProps {
  /** 0–1. */
  value: number;
  label: string;
  showValue?: boolean;
  tone?: "gold" | "forest" | "lilac";
  size?: "sm" | "md";
  className?: string;
}

const TONE_FILL = {
  gold: "bg-gold-500",
  forest: "bg-forest-600 dark:bg-forest-400",
  lilac: "bg-lilac-600",
} as const;

export function ProgressBar({
  value,
  label,
  showValue = false,
  tone = "gold",
  size = "md",
  className,
}: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);

  return (
    <div className={cn("space-y-1.5", className)}>
      {showValue ? (
        <div className="flex items-baseline justify-between gap-3">
          <span className="type-meta text-ink-secondary">{label}</span>
          <span className="type-meta type-numeric text-ink">{percent}%</span>
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={cn(
          "w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--kx-text)_9%,transparent)]",
          size === "sm" ? "h-1" : "h-1.5",
        )}
      >
        <motion.div
          className={cn("h-full rounded-full", TONE_FILL[tone])}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={transitions.springSoft}
        />
      </div>
    </div>
  );
}

/** Numbered step indicator used by the driver application wizard. */
export function StepIndicator({
  steps,
  currentIndex,
  onStepClick,
  className,
}: {
  steps: { id: string; number: string; label: string }[];
  currentIndex: number;
  onStepClick?: (index: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <ol className="kx-no-scrollbar flex items-center gap-1 overflow-x-auto">
        {steps.map((step, index) => {
          const complete = index < currentIndex;
          const active = index === currentIndex;
          const reachable = index <= currentIndex;

          return (
            <li key={step.id} className="shrink-0">
              <button
                type="button"
                disabled={!reachable || !onStepClick}
                onClick={() => onStepClick?.(index)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-full px-3 text-[0.8125rem] font-medium transition-colors sm:h-9",
                  active
                    ? "bg-forest-800 text-white dark:bg-gold-500 dark:text-forest-950"
                    : complete
                      ? "text-ink hover:bg-surface-nested"
                      : "text-ink-muted",
                  reachable && onStepClick && !active && "cursor-pointer",
                )}
              >
                <span className="type-numeric opacity-60">{step.number}</span>
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>

      <ProgressBar
        value={(currentIndex + 1) / steps.length}
        label={`Step ${currentIndex + 1} of ${steps.length}`}
        size="sm"
      />
    </div>
  );
}
