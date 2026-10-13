"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { SPRING } from "@/constants/design-tokens";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

/**
 * Morphing bubble navigation.
 *
 * A compact pill rail. The selected destination grows into a lens that
 * carries its label; the others stay icon-only. The lens is one shared
 * layout element, so it glides and reshapes between items on a spring
 * instead of jumping. Every item is a real link with an accessible name, and
 * badges are announced as text, not colour alone.
 */

export interface BubbleNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Unread count or similar; 0 hides it. */
  badge?: number;
  /** Extra paths that count as this destination. */
  match?: (pathname: string) => boolean;
}

export function BubbleNav({ items, label, className }: { items: BubbleNavItem[]; label: string; className?: string }) {
  const pathname = usePathname();
  const { prefersReduced } = useReducedMotionSafe();
  const spring = prefersReduced ? { duration: 0 } : SPRING.snappy;
  const activeIndex = items.findIndex((item) => (item.match ? item.match(pathname) : pathname === item.href));

  return (
    <nav aria-label={label} className={cn("pointer-events-auto", className)}>
      <LayoutGroup id={label}>
        <motion.ul
          layout
          transition={spring}
          className="flex items-center gap-0.5 rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-glass)] p-1.5 shadow-[var(--ride-elev-4)] backdrop-blur-xl"
        >
          {items.map((item, index) => {
            const active = index === activeIndex;
            const Icon = item.icon;
            return (
              <motion.li key={item.href} layout transition={spring} className="relative">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "ride-press relative flex h-12 w-[3.35rem] items-center justify-center rounded-[18px] outline-offset-4 min-[360px]:w-[3.8rem] lg:w-[4.5rem]",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="bubble-lens"
                      transition={spring}
                      className="absolute inset-0 rounded-[18px] bg-[var(--ride-primary)] shadow-sm"
                      aria-hidden
                    />
                  ) : null}
                  <motion.span
                    layout="position"
                    transition={spring}
                    className={cn("relative z-10 flex flex-col items-center gap-1", active ? "text-[var(--ride-on-primary)]" : "text-[var(--text-secondary)]")}
                  >
                    <motion.span animate={{ y: active ? -1 : 0, scale: active ? 1.06 : 1 }} transition={spring} className="flex">
                      <Icon className="size-[1.3rem]" strokeWidth={active ? 2.1 : 1.8} aria-hidden />
                    </motion.span>
                    <span className="whitespace-nowrap text-[.625rem] leading-none font-semibold tracking-[-.01em]">{item.label}</span>
                  </motion.span>
                  {item.badge ? (
                    <span className="absolute top-1.5 right-1.5 z-20 flex min-w-[1.125rem] items-center justify-center rounded-full bg-[var(--ride-sos)] px-1 text-[0.625rem] leading-[1.125rem] font-bold text-white ring-2 ring-[var(--kx-forest-900)] dark:ring-[var(--kx-graphite-800)]">
                      {item.badge > 9 ? "9+" : item.badge}
                      <span className="sr-only"> unread</span>
                    </span>
                  ) : null}
                </Link>
              </motion.li>
            );
          })}
        </motion.ul>
      </LayoutGroup>
    </nav>
  );
}
