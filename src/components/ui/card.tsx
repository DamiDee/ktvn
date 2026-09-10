import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Card hierarchy: Surface → Card → NestedTile → Pill.
 * Radii stay large and borders stay thin — no hard boxy divisions.
 */

type Elevation = "flat" | "raised" | "floating" | "glass" | "dark";

const ELEVATION: Record<Elevation, string> = {
  flat: "surface-nested",
  raised: "surface-card",
  floating: "bg-surface border border-line shadow-lg",
  glass: "surface-glass",
  dark: "surface-dark",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: Elevation;
  /** Adds hover lift + border warmth. Use for anything clickable. */
  interactive?: boolean;
  padded?: boolean;
  radius?: "md" | "lg" | "xl" | "2xl";
}

const RADIUS: Record<NonNullable<CardProps["radius"]>, string> = {
  md: "rounded-[var(--kx-radius-md)]",
  lg: "rounded-[var(--kx-radius-lg)]",
  xl: "rounded-[var(--kx-radius-xl)]",
  "2xl": "rounded-[var(--kx-radius-2xl)]",
};

export function Card({
  elevation = "raised",
  interactive = false,
  padded = true,
  radius = "lg",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "relative",
        RADIUS[radius],
        ELEVATION[elevation],
        padded && "p-5 sm:p-6",
        interactive &&
          "cursor-pointer transition-[transform,box-shadow,border-color] duration-[250ms] ease-[var(--kx-ease-standard)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}

export function CardHeader({
  title,
  description,
  action,
  eyebrow,
  className,
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        // Wraps rather than overflowing when the action is wide on narrow screens.
        "flex flex-wrap items-start justify-between gap-x-4 gap-y-2",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="type-micro mb-1.5 text-ink-muted">{eyebrow}</p>
        ) : null}
        <h3 className="type-card-title text-ink">{title}</h3>
        {description ? (
          <p className="type-meta mt-1 text-ink-secondary">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Nested information tile — one level below a card. */
export function NestedTile({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--kx-radius-md)] border border-line bg-surface-nested p-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Small labelled value pair used inside tiles. */
export function DataPoint({
  label,
  value,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="type-micro text-ink-muted">{label}</p>
      <p className="type-card-title mt-1 truncate text-ink">{value}</p>
      {hint ? <p className="type-meta mt-0.5 text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("kx-hairline my-4", className)} role="presentation" />;
}
