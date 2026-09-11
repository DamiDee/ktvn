"use client";

import { motion } from "motion/react";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

const container = {
  animate: { transition: { staggerChildren: 0.09, delayChildren: 0.12 } },
};

const item = {
  initial: { opacity: 0, y: 18 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.62, ease: [0.16, 1, 0.3, 1] as const },
  },
};

/** Hero text. Rises into place ahead of the map mockup. */
export function HeroCopy() {
  return (
    <motion.div variants={container} initial="initial" animate="animate">
      <motion.div variants={item}>
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5">
          <BadgeCheck
            className="size-3.5 text-forest-600 dark:text-gold-400"
            strokeWidth={2}
            aria-hidden
          />
          <span className="type-meta font-medium text-ink-secondary">
            Members-only · Verified drivers
          </span>
        </span>
      </motion.div>

      <motion.h1 variants={item} className="type-display mt-6 text-ink">
        Move together.
        <br />
        Travel with{" "}
        <span className="kx-text-gradient-gold">confidence</span>.
      </motion.h1>

      <motion.p variants={item} className="type-body-lg mt-5 max-w-lg text-ink-secondary">
        Verified rides for the Koinonia community—volunteer or professional,
        with every journey visible from pickup to arrival.
      </motion.p>

      <motion.div variants={item} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/signup" variant="primary" size="lg" pill iconRight={ArrowRight}>
          Find a Ride
        </ButtonLink>
        <ButtonLink href="/driver/apply" variant="secondary" size="lg" pill>
          Become a Driver
        </ButtonLink>
      </motion.div>

    </motion.div>
  );
}
