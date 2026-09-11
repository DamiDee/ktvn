"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { Clock3, MapPin, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/badge";
import { DRIVERS } from "@/mocks/people";
import { shortName } from "@/lib/format";

const HERO_DRIVER = DRIVERS[0];

/** Human-led hero image with just enough live-trip UI to explain the product. */
export function HeroMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}
      className="relative isolate lg:pl-3"
    >
      <span
        aria-hidden
        className="kx-liquid-drop kx-liquid-drop-c absolute -top-12 -right-7 -z-10 size-40 bg-gold-300/36 blur-sm dark:bg-gold-400/14"
      />
      <span
        aria-hidden
        className="kx-liquid-drop kx-liquid-drop-b absolute -bottom-14 -left-8 -z-10 size-52 bg-forest-200/60 blur-sm dark:bg-forest-500/16"
      />

      <div className="relative min-h-[430px] overflow-hidden rounded-[var(--kx-radius-2xl)] bg-forest-900 shadow-xl sm:min-h-[540px]">
        <Image
          src="/images/community-ride-hero.png"
          alt="A smiling passenger meeting her driver outside a community gathering."
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 52vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950/80 via-forest-950/5 to-forest-950/10" />

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 1.05, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-6 left-6 rounded-full border border-white/20 bg-forest-950/54 px-3.5 py-2 text-white shadow-lg backdrop-blur-xl"
        >
          <span className="flex items-center gap-2">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-300" />
            </span>
            <span className="type-meta text-white/90">Driver is 4 minutes away</span>
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.62, delay: 1.15, ease: [0.16, 1, 0.3, 1] }}
          className="absolute right-5 bottom-5 left-5 rounded-[var(--kx-radius-xl)] border border-white/18 bg-white/88 p-4 shadow-xl backdrop-blur-2xl dark:bg-graphite-950/84 sm:right-7 sm:bottom-7 sm:left-7"
        >
          <div className="flex items-center gap-3.5">
            <Avatar
              name={HERO_DRIVER.fullName}
              src={HERO_DRIVER.avatarUrl}
              size="lg"
              verified
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="type-card-title text-ink">{shortName(HERO_DRIVER.fullName)}</p>
                <VerifiedBadge label="Verified driver" />
              </div>
              <p className="type-meta mt-1 truncate text-ink-secondary">
                {HERO_DRIVER.vehicle.colour} {HERO_DRIVER.vehicle.make} · {HERO_DRIVER.vehicle.plateNumber}
              </p>
            </div>
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-[68%_32%_62%_38%/72%_42%_58%_28%] bg-forest-800 text-gold-300">
              <ShieldCheck className="size-5" strokeWidth={1.8} aria-hidden />
            </span>
          </div>

          <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-line pt-3.5">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-forest-100 text-forest-700 dark:bg-forest-500/20 dark:text-gold-300">
              <MapPin className="size-4" strokeWidth={1.8} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="type-micro text-ink-muted">Pickup</p>
              <p className="truncate text-[0.875rem] font-medium text-ink">Koinonia Centre</p>
            </div>
            <span className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-secondary">
              <Clock3 className="size-3.5" strokeWidth={1.8} aria-hidden />
              8:42 PM
            </span>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, delay: 1.45, ease: [0.16, 1, 0.3, 1] }}
        className="surface-glass absolute top-[30%] -right-5 hidden items-center gap-3 rounded-[58%_42%_54%_46%/44%_48%_52%_56%] px-4 py-3 xl:flex"
      >
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-gold-500/15 text-gold-700 dark:text-gold-300">
          <ShieldCheck className="size-4" strokeWidth={1.8} aria-hidden />
        </span>
        <div>
          <p className="type-micro text-ink-muted">Peace of mind</p>
          <p className="text-[0.875rem] font-medium text-ink">Journey shared</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
