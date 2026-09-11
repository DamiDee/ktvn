"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { MARKETING_NAV } from "@/constants/navigation";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { KoinoniaMark } from "@/components/ui/route-loader";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <motion.div
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full px-4 py-2.5 transition-[background-color,box-shadow,border-color] duration-[280ms] sm:px-5",
          scrolled
            ? "surface-glass"
            : "border border-transparent bg-transparent",
        )}
      >
        <Link
          href="/"
          className="kx-tap flex shrink-0 items-center gap-2.5"
          aria-label="K-Rides — home"
        >
          <KoinoniaMark className="size-6 text-forest-800 dark:text-gold-400" />
          <span className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-ink">
            K-Rides
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-[0.875rem] font-medium text-ink-secondary transition-colors hover:bg-[color-mix(in_srgb,var(--kx-text)_6%,transparent)] hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <ButtonLink
            href="/login"
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          >
            Sign in
          </ButtonLink>
          <ButtonLink href="/signup" variant="primary" size="sm" pill>
            Find a Ride
          </ButtonLink>
          <IconButton
            icon={menuOpen ? X : Menu}
            label={menuOpen ? "Close menu" : "Open menu"}
            size="sm"
            className="lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
          />
        </div>
      </motion.div>

      <AnimatePresence>
        {menuOpen ? (
          <motion.nav
            aria-label="Mobile"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="surface-glass mx-auto mt-2 max-w-6xl rounded-[var(--kx-radius-xl)] p-3 lg:hidden"
          >
            <div className="flex flex-col">
              {MARKETING_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-[var(--kx-radius-sm)] px-4 py-3 text-[0.9375rem] font-medium text-ink transition-colors hover:bg-[color-mix(in_srgb,var(--kx-text)_6%,transparent)]"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 border-t border-line px-1 pt-3">
              <ThemeToggle />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMenuOpen(false)}
                className="sm:hidden"
              >
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
