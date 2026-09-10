import type { ReactNode } from "react";
import { BadgeCheck, Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  TONE_CLASSES,
  TONE_DOT,
  type StatusPresentation,
  type StatusTone,
} from "@/constants/status-presentation";

/**
 * Status chips always pair colour with a label, and optionally an icon, so
 * status is never conveyed by colour alone.
 */

export interface StatusChipProps {
  tone: StatusTone;
  children: ReactNode;
  icon?: LucideIcon;
  /** Small solid dot before the label. */
  dot?: boolean;
  /** Gently pulses the dot — reserved for genuinely live states. */
  live?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function StatusChip({
  tone,
  children,
  icon: Icon,
  dot = false,
  live = false,
  size = "sm",
  className,
}: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm"
          ? "px-2.5 py-1 text-[0.75rem]"
          : "px-3 py-1.5 text-[0.8125rem]",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot ? (
        <span className="relative flex size-1.5 shrink-0">
          {live ? (
            <span
              className={cn(
                "absolute inline-flex size-full rounded-full opacity-70",
                TONE_DOT[tone],
              )}
              style={{ animation: "kx-pulse-ring 2s ease-out infinite" }}
              aria-hidden
            />
          ) : null}
          <span
            className={cn("relative inline-flex size-1.5 rounded-full", TONE_DOT[tone])}
          />
        </span>
      ) : null}
      {Icon ? <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Renders a StatusPresentation directly — the common case. */
export function StatusBadge({
  presentation,
  icon,
  dot = true,
  live,
  size,
  className,
}: {
  presentation: StatusPresentation;
  icon?: LucideIcon;
  dot?: boolean;
  live?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <StatusChip
      tone={presentation.tone}
      icon={icon}
      dot={dot}
      live={live}
      size={size}
      className={className}
    >
      {presentation.label}
    </StatusChip>
  );
}

export interface BadgeProps {
  children: ReactNode;
  variant?: "neutral" | "gold" | "forest" | "lilac" | "outline";
  className?: string;
}

const BADGE_VARIANTS = {
  neutral:
    "bg-[color-mix(in_srgb,var(--kx-text)_7%,transparent)] text-ink-secondary",
  gold: "bg-gold-100 text-gold-800 dark:bg-gold-500/18 dark:text-gold-200",
  forest:
    "bg-forest-100 text-forest-800 dark:bg-forest-500/18 dark:text-forest-100",
  lilac: "bg-lilac-100 text-lilac-800 dark:bg-lilac-500/18 dark:text-lilac-100",
  outline: "border border-line-strong text-ink-secondary",
} as const;

export function Badge({ children, variant = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.75rem] font-medium",
        BADGE_VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Trust labels. Used sparingly — "Verified Member", "Verified Driver",
 * "Vehicle Verified" — never a shield on every surface.
 */
export function VerifiedBadge({
  label = "Verified",
  tone = "forest",
  size = "sm",
  className,
}: {
  label?: string;
  tone?: "forest" | "gold" | "lilac";
  size?: "sm" | "md";
  className?: string;
}) {
  const toneClass =
    tone === "gold"
      ? "bg-gold-100 text-gold-800 ring-gold-300/50 dark:bg-gold-500/15 dark:text-gold-200 dark:ring-gold-600/40"
      : tone === "lilac"
        ? "bg-lilac-100 text-lilac-800 ring-lilac-300/50 dark:bg-lilac-500/15 dark:text-lilac-100 dark:ring-lilac-500/35"
        : "bg-forest-100 text-forest-800 ring-forest-300/50 dark:bg-forest-500/18 dark:text-forest-100 dark:ring-forest-400/35";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset",
        size === "sm" ? "px-2 py-0.5 text-[0.6875rem]" : "px-2.5 py-1 text-[0.8125rem]",
        toneClass,
        className,
      )}
    >
      <BadgeCheck
        className={size === "sm" ? "size-3.5" : "size-4"}
        strokeWidth={2}
        aria-hidden
      />
      {label}
    </span>
  );
}

/** Small animated tick used when a verification step completes. */
export function AnimatedCheck({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-success-500 text-white",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Check
        className="size-[62%]"
        strokeWidth={3}
        style={{
          strokeDasharray: 24,
          strokeDashoffset: 24,
          animation: "kx-dash 420ms var(--kx-ease-out) 120ms forwards",
        }}
        aria-hidden
      />
    </span>
  );
}
