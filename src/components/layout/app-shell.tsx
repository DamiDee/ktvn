"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import { pageVariants } from "@/lib/motion";
import type { NavItem } from "@/constants/navigation";
import { Avatar } from "@/components/ui/avatar";
import { KoinoniaMark } from "@/components/ui/route-loader";
import { StatusChip } from "@/components/ui/badge";
import { ThemeToggle } from "./theme-toggle";
import { SideNav, BottomNav } from "./side-nav";
import { NotificationBell, NotificationDrawer } from "./notification-drawer";
import { ActiveRideIndicator } from "./active-ride-indicator";

export interface AppShellUser {
  name: string;
  avatarUrl?: string;
  /** e.g. "Verified Member", "Volunteer Driver", "Oversight". */
  roleLabel: string;
  profileHref: string;
  verified?: boolean;
}

export interface AppShellProps {
  nav: NavItem[];
  user: AppShellUser;
  children: ReactNode;
  /** Compact status line in the rail, e.g. an active ride or availability. */
  railStatus?: { label: string; tone: "active" | "pending" | "neutral"; live?: boolean };
  /** Removes page padding — used by full-bleed map screens. */
  bleed?: boolean;
}

/**
 * Role shell: dark navigation rail on desktop, collapsible on tablet,
 * bottom navigation on mobile. Passenger, driver and admin all use this,
 * differing only in the nav items and identity block they pass in.
 */
export function AppShell({
  nav,
  user,
  children,
  railStatus,
  bleed = false,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop / tablet rail */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col bg-forest-900 transition-[width] duration-[280ms] ease-[var(--kx-ease-standard)] lg:flex",
          collapsed ? "w-[76px]" : "w-[248px]",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2.5 px-5 py-6",
            collapsed && "justify-center px-0",
          )}
        >
          <Link href="/" aria-label="K-Rides — home" className="shrink-0">
            <KoinoniaMark className="size-7 text-gold-400" />
          </Link>
          {!collapsed ? (
            <span className="truncate text-[0.9375rem] font-semibold tracking-[-0.02em] text-white">
              K-Rides
            </span>
          ) : null}
        </div>

        <div className={cn("flex-1 overflow-y-auto kx-scroll-thin", collapsed ? "px-3" : "px-3")}>
          <SideNav items={nav} collapsed={collapsed} />
        </div>

        {railStatus && !collapsed ? (
          <div className="px-4 pb-3">
            <div className="rounded-[var(--kx-radius-md)] bg-white/[0.06] p-3">
              <p className="type-micro mb-2 text-white/45">Status</p>
              <StatusChip tone={railStatus.tone} dot live={railStatus.live}>
                {railStatus.label}
              </StatusChip>
            </div>
          </div>
        ) : null}

        <div className={cn("border-t border-white/8 p-3", collapsed && "px-2")}>
          <Link
            href={user.profileHref}
            className={cn(
              "flex items-center gap-3 rounded-full p-1.5 transition-colors hover:bg-white/8",
              collapsed && "justify-center",
            )}
          >
            <Avatar
              name={user.name}
              src={user.avatarUrl}
              size="sm"
              verified={user.verified}
            />
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8125rem] font-medium text-white">
                  {user.name}
                </p>
                <p className="type-meta truncate text-white/45">{user.roleLabel}</p>
              </div>
            ) : null}
          </Link>

          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className={cn(
              "mt-2 flex w-full items-center gap-3 rounded-full px-3.5 py-2 text-[0.8125rem] font-medium text-white/45 transition-colors hover:bg-white/8 hover:text-white",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" strokeWidth={1.8} aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="size-4" strokeWidth={1.8} aria-hidden />
                Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      {/*
        Content column. A flex column with explicit heights on the bars, so a
        full-bleed map can take exactly the space that's left instead of
        guessing at a header height and overflowing underneath it.
      */}
      <div
        className={cn(
          "flex flex-col transition-[padding] duration-[280ms] ease-[var(--kx-ease-standard)]",
          collapsed ? "lg:pl-[76px]" : "lg:pl-[248px]",
          bleed ? "h-dvh overflow-hidden" : "min-h-dvh",
        )}
      >
        {/* Mobile / tablet top bar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-canvas/88 px-4 backdrop-blur-xl sm:px-6 lg:hidden">
          <Link
            href="/"
            className="kx-tap flex items-center gap-2.5"
            aria-label="K-Rides — home"
          >
            <KoinoniaMark className="size-6 text-forest-800 dark:text-gold-400" />
            <span className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-ink">
              K-Rides
            </span>
          </Link>

          <div className="flex min-w-0 items-center gap-1">
            {/* The three-way theme control needs room; below 360px the header
                keeps the notification bell and avatar instead. */}
            <div className="hidden min-[360px]:block">
              <ThemeToggle />
            </div>
            <NotificationBell tone="default" />
            <Link href={user.profileHref} aria-label="Your profile" className="ml-1">
              <Avatar
                name={user.name}
                src={user.avatarUrl}
                size="sm"
                verified={user.verified}
              />
            </Link>
          </div>
        </header>

        {/* Desktop utility bar */}
        <div className="sticky top-0 z-30 hidden h-14 shrink-0 items-center justify-end gap-2 border-b border-line bg-canvas/88 px-6 backdrop-blur-xl lg:flex">
          <ThemeToggle />
          <NotificationBell tone="default" />
        </div>

        <motion.main
          id="main"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          className={cn(
            "flex-1",
            bleed
              ? // Reserve the mobile nav bar so a sheet anchored to the bottom
                // of this area still sits above it.
                "min-h-0 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0"
              : "px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:pb-8",
          )}
        >
          {children}
        </motion.main>
      </div>

      <BottomNav items={nav} />
      <NotificationDrawer />
      <ActiveRideIndicator />
    </div>
  );
}

/** Page heading used inside AppShell content areas. */
export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="type-micro mb-2 text-ink-muted">{eyebrow}</p>
        ) : null}
        <h1 className="type-page-title text-ink">{title}</h1>
        {description ? (
          <p className="type-body mt-2 max-w-2xl text-ink-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
