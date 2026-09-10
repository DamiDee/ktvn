"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  Compass,
  MapPinOff,
  RefreshCw,
  ShieldCheck,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { RouteMedallion } from "./route-medallion";
import { viewportOnce } from "@/lib/motion";

// Re-exported so existing imports from "@/components/ui/states" keep working.
export { RouteMedallion };

/**
 * Empty and error states are always contextual — they name the thing that is
 * missing and offer the next useful action. Never "Error 500".
 */

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  /** Custom illustration replacing the default icon medallion. */
  illustration?: ReactNode;
  action?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Compass,
  illustration,
  action,
  size = "md",
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewportOnce}
      transition={{ duration: 0.35 }}
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--kx-radius-lg)] border border-dashed border-line-strong bg-surface-nested/60 text-center",
        size === "sm" ? "gap-3 px-6 py-8" : "gap-4 px-6 py-14",
        className,
      )}
    >
      {illustration ?? <RouteMedallion icon={Icon} />}

      <div className="max-w-sm space-y-1.5">
        <p className="type-card-title text-ink">{title}</p>
        {description ? (
          <p className="type-meta text-ink-secondary">{description}</p>
        ) : null}
      </div>

      {action}
    </motion.div>
  );
}

export interface ErrorStateProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title,
  description,
  icon = RefreshCw,
  onRetry,
  retryLabel = "Try again",
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-[var(--kx-radius-lg)] border border-line bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      <RouteMedallion icon={icon} tone="danger" />

      <div className="max-w-sm space-y-1.5">
        <p className="type-card-title text-ink">{title}</p>
        {description ? (
          <p className="type-meta text-ink-secondary">{description}</p>
        ) : null}
      </div>

      {action ??
        (onRetry ? (
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null)}
    </div>
  );
}

/** Location permission denied — offered wherever a ride needs a pickup point. */
export function LocationErrorState({
  onEnable,
  className,
}: {
  onEnable?: () => void;
  className?: string;
}) {
  return (
    <ErrorState
      icon={MapPinOff}
      title="We couldn't access your location."
      description="Enable location access to continue your ride request, or set your pickup point manually."
      className={className}
      action={
        onEnable ? (
          <Button variant="primary" size="sm" onClick={onEnable}>
            Enable location
          </Button>
        ) : undefined
      }
    />
  );
}

/** Map failure — never replaces the whole page. */
export function MapUnavailableNotice({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "surface-glass flex items-center gap-2.5 rounded-full px-4 py-2.5",
        className,
      )}
    >
      <WifiOff className="size-4 shrink-0 text-ink-muted" strokeWidth={1.8} aria-hidden />
      <p className="type-meta text-ink-secondary">
        Live location is temporarily unavailable.
      </p>
    </div>
  );
}

/** Reassurance block used on safety surfaces. */
export function SafetyNote({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[var(--kx-radius-md)] border border-line bg-surface-nested p-4",
        className,
      )}
    >
      <ShieldCheck
        className="mt-0.5 size-4.5 shrink-0 text-forest-600 dark:text-gold-400"
        strokeWidth={1.7}
        aria-hidden
      />
      <p className="type-meta text-ink-secondary">{children}</p>
    </div>
  );
}
