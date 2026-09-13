"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { MapPin, ShieldCheck } from "lucide-react";
import { KoinoniaMark } from "@/components/ui/route-loader";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LiquidBackdrop } from "@/components/ui/liquid-backdrop";

/**
 * Split-screen auth layout: a warm human transport moment on the left and the
 * focused form on the right. On mobile the image collapses to a slim banner.
 */
export function AuthShell({
  children,
  trustStatement,
  eyebrow,
}: {
  children: ReactNode;
  trustStatement?: string;
  eyebrow?: string;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <AuthVisual trustStatement={trustStatement} eyebrow={eyebrow} />

      {/* min-w-0 so a wide child can never stretch the column past the
          viewport on a phone. */}
      <main
        id="main"
        className="relative flex min-w-0 flex-col justify-center px-5 py-10 sm:px-10 lg:px-14"
      >
        <div className="absolute top-5 right-5 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-md"
        >
          <Link
            href="/"
            className="kx-tap mb-8 inline-flex items-center gap-2.5 lg:hidden"
            aria-label="K-Rides — home"
          >
            <KoinoniaMark className="size-6 text-forest-800 dark:text-gold-400" />
            <span className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-ink">
              K-Rides
            </span>
          </Link>

          {children}
        </motion.div>
      </main>
    </div>
  );
}

function AuthVisual({
  trustStatement,
  eyebrow,
}: {
  trustStatement?: string;
  eyebrow?: string;
}) {
  return (
    <aside className="relative h-44 overflow-hidden bg-forest-900 sm:h-56 lg:h-auto">
      <Image
        src="/images/community-login.png"
        alt="A smiling passenger being welcomed by her community driver."
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 52vw"
        className="object-cover"
      />

      {/* Legibility scrim */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-forest-950/96 via-forest-950/24 to-forest-950/42"
        aria-hidden
      />
      <LiquidBackdrop inverse className="opacity-55 mix-blend-screen" />

      <div className="relative hidden h-full flex-col justify-between p-10 lg:flex xl:p-12">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2.5"
          aria-label="K-Rides — home"
        >
          <KoinoniaMark className="size-7 text-gold-400" />
          <span className="text-[1rem] font-semibold tracking-[-0.02em] text-white">
            K-Rides
          </span>
        </Link>

        <div className="max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 inline-flex items-center gap-3 rounded-[var(--kx-radius-lg)] border border-white/18 bg-forest-950/45 px-4 py-3 text-white backdrop-blur-xl"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-[70%_30%_62%_38%/74%_40%_60%_26%] bg-gold-400 text-forest-950">
              <ShieldCheck className="size-4.5" strokeWidth={1.9} aria-hidden />
            </span>
            <span>
              <span className="type-micro block text-gold-300">Verified journey</span>
              <span className="type-meta mt-0.5 flex items-center gap-1.5 text-white/80">
                <MapPin className="size-3.5" strokeWidth={1.8} aria-hidden />
                Koinonia Centre · Abuja
              </span>
            </span>
          </motion.div>
          {eyebrow ? (
            <p className="type-micro mb-3 text-gold-400">{eyebrow}</p>
          ) : null}
          <p className="type-section-title text-white">
            {trustStatement ??
              "Every rider and every driver on this network is verified before a single journey begins."}
          </p>
          <p className="type-meta mt-4 text-white/55">
            Member identity, driver licence, vehicle documents and a physical
            inspection — the same five checks for both tracks.
          </p>
        </div>
      </div>
    </aside>
  );
}
