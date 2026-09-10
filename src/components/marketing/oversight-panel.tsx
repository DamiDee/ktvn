"use client";

import { motion } from "motion/react";
import { BadgeCheck, ClipboardList, Radio, ShieldAlert } from "lucide-react";
import { CountUp } from "@/components/ui/stats-card";
import { viewportOnce } from "@/lib/motion";

/**
 * Public-facing view of platform oversight. Deliberately aggregate — no
 * names, routes or member details appear here.
 */
const PANELS = [
  {
    icon: BadgeCheck,
    label: "Verified drivers",
    value: 128,
    detail: "Approved across both tracks",
  },
  {
    icon: Radio,
    label: "Journeys today",
    value: 337,
    detail: "Tracked from request to arrival",
  },
  {
    icon: ClipboardList,
    label: "In verification",
    value: 6,
    detail: "Applications under review",
  },
  {
    icon: ShieldAlert,
    label: "Alerts responded to",
    value: 2,
    detail: "Acknowledged within minutes",
  },
];

export function OversightPanel() {
  return (
    <div className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
      {PANELS.map((panel, index) => {
        const Icon = panel.icon;
        return (
          <motion.div
            key={panel.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.5, delay: index * 0.08 }}
            className="rounded-[var(--kx-radius-xl)] border border-white/10 bg-white/[0.04] p-5"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
              <Icon className="size-4.5" strokeWidth={1.7} aria-hidden />
            </span>
            <p className="type-numeric mt-4 text-[1.875rem] leading-none font-semibold text-white">
              <CountUp value={panel.value} />
            </p>
            <p className="type-card-title mt-2 text-white">{panel.label}</p>
            <p className="type-meta mt-1 text-white/55">{panel.detail}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
