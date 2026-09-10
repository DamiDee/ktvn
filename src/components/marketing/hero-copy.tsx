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
        A verified transportation network built for the Koinonia community.
        Find trusted volunteer or professional drivers, travel with live trip
        visibility, and stay connected from departure to destination.
      </motion.p>

      <motion.div variants={item} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/signup" variant="primary" size="lg" pill iconRight={ArrowRight}>
          Find a Ride
        </ButtonLink>
        <ButtonLink href="/driver/apply" variant="secondary" size="lg" pill>
          Become a Driver
        </ButtonLink>
      </motion.div>

      <motion.dl
        variants={item}
        className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6"
      >
        {[
          { value: "128", label: "Verified drivers" },
          { value: "5", label: "Verification checks" },
          { value: "3", label: "Riders per shared trip" },
        ].map((stat) => (
          <div key={stat.label}>
            <dt className="sr-only">{stat.label}</dt>
            <dd>
              <span className="type-numeric block text-[1.5rem] leading-none font-semibold text-ink">
                {stat.value}
              </span>
              <span className="type-meta mt-1.5 block text-ink-muted">
                {stat.label}
              </span>
            </dd>
          </div>
        ))}
      </motion.dl>
    </motion.div>
  );
}
