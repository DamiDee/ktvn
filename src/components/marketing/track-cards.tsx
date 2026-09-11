"use client";

import { motion } from "motion/react";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Check,
  HandHeart,
  Receipt,
  Route,
  Star,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/badge";
import { viewportOnce } from "@/lib/motion";

interface TrackCardProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  points: { icon: LucideIcon; label: string }[];
  cta: { href: string; label: string };
  tone: "volunteer" | "professional";
  delay?: number;
}

/**
 * The two tracks are presented as equals — volunteer is not a lesser tier.
 * Volunteer cards never show a fare, a currency symbol or a payment control.
 */
function TrackCard({
  eyebrow,
  title,
  description,
  icon: Icon,
  points,
  cta,
  tone,
  delay = 0,
}: TrackCardProps) {
  const isVolunteer = tone === "volunteer";

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewportOnce}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[var(--kx-radius-2xl)] border p-7 sm:p-8",
        "transition-[transform,box-shadow,border-color] duration-[280ms] ease-[var(--kx-ease-standard)]",
        "hover:-translate-y-1 hover:shadow-xl",
        isVolunteer
          ? "border-gold-200/80 bg-gradient-to-br from-gold-50/80 to-surface dark:border-gold-700/30 dark:from-gold-500/8 dark:to-surface"
          : "border-lilac-200/70 bg-gradient-to-br from-lilac-50/70 to-surface dark:border-lilac-700/30 dark:from-lilac-500/8 dark:to-surface",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-[var(--kx-radius-md)]",
            isVolunteer
              ? "bg-gold-500/18 text-gold-700 dark:text-gold-300"
              : "bg-lilac-500/16 text-lilac-700 dark:text-lilac-300",
          )}
        >
          <Icon className="size-5" strokeWidth={1.7} aria-hidden />
        </span>
        <VerifiedBadge
          label="Same safety standard"
          tone={isVolunteer ? "gold" : "lilac"}
        />
      </div>

      <p className="type-micro mt-5 text-ink-muted">{eyebrow}</p>
      <h3 className="type-section-title mt-2 text-ink">{title}</h3>
      <p className="type-body mt-3 text-ink-secondary">{description}</p>

      <details className="group mt-5 rounded-[var(--kx-radius-md)] border border-line bg-surface/75">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--kx-radius-md)] px-4 py-3.5 outline-none transition-colors hover:bg-surface-nested focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
          <span className="type-meta font-semibold text-ink">What&rsquo;s included</span>
          <ChevronDown
            className="size-4 text-ink-muted transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <ul className="space-y-2.5 border-t border-line px-4 py-4">
          {points.map((point) => {
            const PointIcon = point.icon;
            return (
              <li key={point.label} className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-full",
                    isVolunteer
                      ? "bg-gold-500/14 text-gold-700 dark:text-gold-300"
                      : "bg-lilac-500/14 text-lilac-700 dark:text-lilac-300",
                  )}
                >
                  <PointIcon className="size-3.5" strokeWidth={1.9} aria-hidden />
                </span>
                <span className="type-meta text-ink-secondary">{point.label}</span>
              </li>
            );
          })}
        </ul>
      </details>

      <div className="mt-5">
        <ButtonLink
          href={cta.href}
          variant={isVolunteer ? "secondary" : "secondary"}
          size="md"
          iconRight={ArrowRight}
          className="w-full sm:w-auto"
        >
          {cta.label}
        </ButtonLink>
      </div>
    </motion.article>
  );
}

export function TrackCards() {
  return (
    <div className="mt-9 grid gap-5 sm:mt-11 lg:grid-cols-2">
      <TrackCard
        tone="volunteer"
        eyebrow="Track A · Volunteer"
        title="Ride through service"
        description="Verified members offer spare seats at no charge."
        icon={HandHeart}
        points={[
          { icon: Check, label: "No fare and no payment prompt" },
          { icon: BadgeCheck, label: "Verified driver and vehicle" },
          { icon: Route, label: "Tracked from departure to destination" },
          { icon: Star, label: "Two-way ratings" },
        ]}
        cta={{ href: "/signup", label: "Explore Volunteer Rides" }}
      />

      <TrackCard
        tone="professional"
        eyebrow="Track B · Professional"
        title="Reliable paid transportation"
        description="Paid journeys with the fare agreed before you travel."
        icon={Wallet}
        points={[
          { icon: Check, label: "Fare shown upfront, before you request" },
          { icon: Route, label: "Private or shared, up to three riders" },
          { icon: Receipt, label: "Receipt after every journey" },
          { icon: BadgeCheck, label: "Verified driver and vehicle" },
          { icon: Star, label: "Live trip tracking" },
        ]}
        cta={{ href: "/signup", label: "Explore Professional Rides" }}
        delay={0.1}
      />
    </div>
  );
}
