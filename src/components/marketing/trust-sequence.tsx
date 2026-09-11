"use client";

import { motion } from "motion/react";
import {
  BadgeCheck,
  Car,
  ChevronDown,
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

/** Secondary verification detail stays available without lengthening the page. */
export function TrustSequence() {
  return (
    <motion.details
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewportOnce}
      transition={{ duration: 0.5 }}
      className="group mt-9 overflow-hidden rounded-[var(--kx-radius-xl)] border border-line bg-surface shadow-sm sm:mt-11"
    >
      <summary className="flex cursor-pointer list-none items-center gap-4 p-5 outline-none transition-colors hover:bg-surface-nested focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-inset sm:p-6 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-gold-500 text-forest-950">
          <BadgeCheck className="size-5" strokeWidth={1.9} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="type-card-title block text-ink">See the five verification checks</span>
          <span className="type-meta mt-1 block text-ink-muted">
            Identity, licence, documents, inspection and approval.
          </span>
        </span>
        <ChevronDown
          className="size-5 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <ol className="grid gap-px border-t border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
        {STAGES.map((stage, index) => {
          const Icon = stage.icon;
          const isFinal = index === STAGES.length - 1;
          return (
            <li
              key={stage.label}
              className={cn(
                "bg-surface p-4 sm:p-5",
                isFinal && "bg-gold-50/70 dark:bg-gold-500/8",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-nested text-ink-secondary">
                  <Icon className="size-4" strokeWidth={1.8} aria-hidden />
                </span>
                <span className="type-meta font-semibold text-ink">{stage.label}</span>
              </div>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-muted">
                {stage.detail}
              </p>
            </li>
          );
        })}
      </ol>
    </motion.details>
  );
}
