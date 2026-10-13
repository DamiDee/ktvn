"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

/**
 * Frame for the module's list and detail pages (activity, safety, account):
 * a calm scrolling column, large title, safe areas respected, and room at
 * the bottom for the floating navigation.
 */
export function RidePage({ title, subtitle, backHref, children, action }: { title: string; subtitle?: ReactNode; backHref?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="kx-scroll-thin absolute inset-0 overflow-y-auto bg-[var(--kx-bg)]">
      <motion.main
        id="main"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto w-full max-w-2xl px-4 sm:px-6"
        // Clears the floating mode switch above the title.
        style={{ paddingTop: "calc(var(--ride-safe-top) + 64px)", paddingBottom: "calc(var(--ride-safe-bottom) + 120px)" }}
      >
        <header className="mb-6 flex items-end justify-between gap-4 pt-2">
          <div className="min-w-0">
            {backHref ? (
              <Link href={backHref} className="ride-press -ml-2 mb-2 inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-[0.875rem] font-semibold text-[var(--text-secondary)]">
                <ArrowLeft className="size-4" aria-hidden /> Back
              </Link>
            ) : null}
            <h1 className="ride-heading-xl">{title}</h1>
            {subtitle ? <p className="ride-body mt-1 text-[var(--text-secondary)]">{subtitle}</p> : null}
          </div>
          {action}
        </header>
        {children}
      </motion.main>
    </div>
  );
}

export function PageSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      {title ? <h2 className="ride-label mb-2.5 px-1">{title}</h2> : null}
      {children}
    </section>
  );
}
