"use client";

import { motion } from "motion/react";
import {
  BadgeCheck,
  Car,
  FileCheck2,
  IdCard,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { viewportOnce } from "@/lib/motion";

const STAGES: { icon: LucideIcon; label: string; detail: string }[] = [
  {
    icon: IdCard,
    label: "Member identity",
    detail: "Membership record confirmed against the community register.",
  },
  {
    icon: Car,
    label: "Driver licence",
    detail: "A current licence, checked for validity and expiry.",
  },
  {
    icon: FileCheck2,
    label: "Vehicle documents",
    detail: "Registration, insurance and roadworthiness reviewed.",
  },
  {
    icon: Wrench,
    label: "Physical inspection",
    detail: "The vehicle is seen in person before approval.",
  },
  {
    icon: BadgeCheck,
    label: "Verified driver",
    detail: "Approved to carry members on either track.",
  },
];

/** Checkmarks activate as the sequence scrolls into view. */
export function TrustSequence() {
  return (
    <ol className="relative mt-12 grid gap-4 sm:mt-16 lg:grid-cols-5">
      {STAGES.map((stage, index) => {
        const Icon = stage.icon;
        const isFinal = index === STAGES.length - 1;

        return (
          <motion.li
            key={stage.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.5, delay: index * 0.12 }}
            className="relative"
          >
            {/* Connector between stages on wide screens */}
            {!isFinal ? (
              <motion.span
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={viewportOnce}
                transition={{ duration: 0.4, delay: index * 0.12 + 0.28 }}
                className="absolute top-9 -right-2 hidden h-px w-4 origin-left bg-line-strong lg:block"
                aria-hidden
              />
            ) : null}

            <div
              className={cn(
                "flex h-full flex-col rounded-[var(--kx-radius-lg)] border p-5",
                isFinal
                  ? "border-gold-300/70 bg-gold-50/70 dark:border-gold-600/40 dark:bg-gold-500/8"
                  : "border-line bg-surface",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-full",
                    isFinal
                      ? "bg-gold-500 text-forest-950"
                      : "bg-surface-nested text-ink-secondary",
                  )}
                >
                  <Icon className="size-4.5" strokeWidth={1.7} aria-hidden />
                </span>

                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={viewportOnce}
                  transition={{
                    type: "spring",
                    stiffness: 320,
                    damping: 20,
                    delay: index * 0.12 + 0.34,
                  }}
                  className="inline-flex size-5 items-center justify-center rounded-full bg-forest-600 text-white dark:bg-forest-500"
                  aria-hidden
                >
                  <svg viewBox="0 0 16 16" className="size-3" fill="none">
                    <path
                      d="M3.5 8.5 6.5 11.5 12.5 5"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.span>
              </div>

              <p className="type-card-title mt-4 text-ink">{stage.label}</p>
              <p className="type-meta mt-1.5 text-ink-secondary">{stage.detail}</p>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
