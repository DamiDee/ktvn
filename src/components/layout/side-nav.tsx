"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { transitions } from "@/lib/motion";
import type { NavItem } from "@/constants/navigation";

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.matchPrefix) return pathname.startsWith(item.href);
  return pathname === item.href;
}

/**
 * Desktop navigation rail. The active pill is a shared layout element, so it
 * glides between items rather than jumping.
 */
export function SideNav({
  items,
  collapsed = false,
  className,
}: {
  items: NavItem[];
  collapsed?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const layoutId = useId();

  return (
    <nav aria-label="Primary" className={cn("flex flex-col gap-1", className)}>
      {items.map((item) => {
        const active = isNavItemActive(item, pathname);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              "group relative flex items-center rounded-full text-[0.875rem] font-medium transition-colors duration-[165ms]",
              collapsed ? "justify-center p-2.5" : "gap-3 px-3.5 py-2.5",
              active ? "text-white" : "text-white/60 hover:text-white",
            )}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-white/12 ring-1 ring-inset ring-white/12"
                transition={transitions.springSnappy}
                aria-hidden
              />
            ) : null}

            <Icon
              className={cn(
                "relative z-10 size-[1.15rem] shrink-0 transition-colors",
                active ? "text-gold-400" : "",
              )}
              strokeWidth={1.8}
              aria-hidden
            />
            {!collapsed ? (
              <span className="relative z-10 truncate">{item.label}</span>
            ) : (
              <span className="sr-only">{item.label}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Mobile bottom navigation.
 *
 * A phone can only carry about five destinations before the labels collide,
 * so anything past the fourth goes into a "More" panel rather than being
 * squeezed. The panel opens above the bar, where a thumb already is.
 */
export function BottomNav({
  items,
  className,
}: {
  items: NavItem[];
  className?: string;
}) {
  const pathname = usePathname();
  const layoutId = useId();
  // The panel is scoped to the route it was opened on, so navigating away
  // closes it without an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const moreOpen = openedOn === pathname;

  const needsMore = items.length > 5;
  const primary = needsMore ? items.slice(0, 4) : items;
  const overflow = needsMore ? items.slice(4) : [];
  const overflowActive = overflow.some((item) => isNavItemActive(item, pathname));

  const columns = primary.length + (needsMore ? 1 : 0);

  return (
    <>
      <AnimatePresence>
        {moreOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpenedOn(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transitions.quick}
              className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--kx-forest-950)_45%,transparent)] backdrop-blur-[2px] lg:hidden"
            />

            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={transitions.springSnappy}
              className="fixed inset-x-3 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.5rem)] z-40 overflow-hidden rounded-[var(--kx-radius-lg)] border border-line bg-surface shadow-lg lg:hidden"
            >
              <p className="type-micro border-b border-line px-4 py-3 text-ink-muted">
                More
              </p>
              <ul>
                {overflow.map((item) => {
                  const active = isNavItemActive(item, pathname);
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpenedOn(null)}
                        className={cn(
                          "flex min-h-14 items-center gap-3.5 border-b border-line px-4 py-3 last:border-0",
                          active ? "bg-surface-nested text-ink" : "text-ink-secondary",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                            active
                              ? "bg-forest-100 text-forest-800 dark:bg-gold-500/18 dark:text-gold-200"
                              : "bg-surface-nested text-ink-muted",
                          )}
                        >
                          <Icon className="size-4.5" strokeWidth={1.8} aria-hidden />
                        </span>
                        <span className="type-body font-medium">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <nav
        aria-label="Primary"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/92 backdrop-blur-xl pb-safe lg:hidden",
          className,
        )}
      >
        <ul
          className="grid"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {primary.map((item) => {
            const active = isNavItemActive(item, pathname) && !moreOpen;
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    // 56px tall keeps the touch target comfortably above the minimum.
                    "relative flex h-14 flex-col items-center justify-center gap-1 px-1",
                    active ? "text-ink" : "text-ink-muted",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId={layoutId}
                      className="absolute top-0 h-0.5 w-8 rounded-full bg-forest-700 dark:bg-gold-500"
                      transition={transitions.springSnappy}
                      aria-hidden
                    />
                  ) : null}
                  <Icon
                    className={cn(
                      "size-[1.2rem] transition-colors",
                      active ? "text-forest-700 dark:text-gold-400" : "",
                    )}
                    strokeWidth={active ? 2 : 1.7}
                    aria-hidden
                  />
                  <span className="w-full truncate text-center text-[0.6875rem] leading-none font-medium">
                    {item.shortLabel ?? item.label}
                  </span>
                </Link>
              </li>
            );
          })}

          {needsMore ? (
            <li>
              <button
                type="button"
                onClick={() => setOpenedOn(moreOpen ? null : pathname)}
                aria-expanded={moreOpen}
                aria-label={moreOpen ? "Close more destinations" : "More destinations"}
                className={cn(
                  "relative flex h-14 w-full flex-col items-center justify-center gap-1 px-1",
                  moreOpen || overflowActive ? "text-ink" : "text-ink-muted",
                )}
              >
                {moreOpen || overflowActive ? (
                  <motion.span
                    layoutId={layoutId}
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-forest-700 dark:bg-gold-500"
                    transition={transitions.springSnappy}
                    aria-hidden
                  />
                ) : null}
                <MoreHorizontal
                  className={cn(
                    "size-[1.2rem] transition-colors",
                    moreOpen || overflowActive
                      ? "text-forest-700 dark:text-gold-400"
                      : "",
                  )}
                  strokeWidth={moreOpen || overflowActive ? 2 : 1.7}
                  aria-hidden
                />
                <span className="text-[0.6875rem] leading-none font-medium">
                  More
                </span>
              </button>
            </li>
          ) : null}
        </ul>
      </nav>
    </>
  );
}
