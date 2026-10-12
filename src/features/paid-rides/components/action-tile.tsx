"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Round contact/safety action with a visible label underneath — labels never
 * depend on recognising the icon. Renders a link, a `tel:` anchor or a button.
 */
export function ActionTile({
  icon: Icon,
  label,
  href,
  onClick,
  badge,
  tone = "default",
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  badge?: number;
  tone?: "default" | "safety";
  disabled?: boolean;
}) {
  const circle = (
    <span
      className={cn(
        "relative flex size-14 items-center justify-center rounded-full transition-colors",
        tone === "safety"
          ? "bg-[color-mix(in_srgb,var(--ride-sos)_10%,transparent)] text-[var(--ride-sos)]"
          : "bg-[var(--surface-secondary)] text-[var(--text-primary)]",
        disabled && "opacity-40",
      )}
    >
      <Icon className="size-[1.3rem]" strokeWidth={1.9} aria-hidden />
      {badge ? (
        <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-[var(--ride-sos)] px-1 text-[0.6875rem] leading-5 font-bold text-white ring-2 ring-[var(--surface-primary)]">
          {badge}
          <span className="sr-only"> unread</span>
        </span>
      ) : null}
    </span>
  );
  const content = (
    <>
      {circle}
      <span className="ride-caption font-semibold text-[var(--text-secondary)]">{label}</span>
    </>
  );
  const className = "ride-press flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-[var(--ride-radius-md)] py-1";

  if (disabled) {
    return (
      <span className={className} aria-disabled>
        {content}
      </span>
    );
  }
  if (href?.startsWith("tel:")) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
