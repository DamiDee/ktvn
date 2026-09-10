import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

// Deliberately not marked "use client": no state, effects or browser APIs, so
// a Server Component can pass it a Lucide icon without crossing the
// serialisation boundary.

/** A soft medallion with a dashed route arc behind the icon. */
export function RouteMedallion({
  icon: Icon,
  tone = "neutral",
}: {
  icon: LucideIcon;
  tone?: "neutral" | "gold" | "danger";
}) {
  const toneClasses =
    tone === "gold"
      ? "bg-gold-50 text-gold-700 dark:bg-gold-500/12 dark:text-gold-300"
      : tone === "danger"
        ? "bg-danger-50 text-danger-600 dark:bg-danger-500/12 dark:text-red-300"
        : "bg-surface text-ink-muted";

  return (
    <span
      className={cn(
        "relative inline-flex size-14 items-center justify-center rounded-full ring-1 ring-line",
        toneClasses,
      )}
    >
      <svg
        viewBox="0 0 56 56"
        className="absolute inset-0 size-full opacity-45"
        fill="none"
        aria-hidden
      >
        <path
          d="M6 42c10 0 8-14 22-14s16-14 22-14"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeDasharray="3 5"
        />
      </svg>
      <Icon className="relative size-6" strokeWidth={1.6} aria-hidden />
    </span>
  );
}
