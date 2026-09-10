"use client";

import { motion } from "motion/react";
import {
  ArrowRight,
  BadgeCheck,
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
          label="Same verification standard"
          tone={isVolunteer ? "gold" : "lilac"}
        />
      </div>

      <p className="type-micro mt-6 text-ink-muted">{eyebrow}</p>
      <h3 className="type-section-title mt-2 text-ink">{title}</h3>
      <p className="type-body mt-3 text-ink-secondary">{description}</p>

      <ul className="mt-6 space-y-3">
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
              <span className="type-body text-ink-secondary">{point.label}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 pt-2">
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
    <div className="mt-12 grid gap-5 sm:mt-16 lg:grid-cols-2">
      <TrackCard
        tone="volunteer"
        eyebrow="Track A · Volunteer"
        title="Ride through service"
        description="Verified members offer the seats they already have. Nothing is charged, nothing is owed — the journey is given."
        icon={HandHeart}
        points={[
          { icon: Check, label: "No fare and no payment prompt" },
          { icon: BadgeCheck, label: "Verified driver and vehicle" },
          { icon: Route, label: "Tracked from departure to destination" },
          { icon: Star, label: "Two-way ratings after every journey" },
          { icon: BadgeCheck, label: "Ministry oversight on every ride" },
        ]}
        cta={{ href: "/signup", label: "Explore Volunteer Rides" }}
      />

      <TrackCard
        tone="professional"
        eyebrow="Track B · Professional"
        title="Reliable paid transportation"
        description="Verified professional drivers provide paid journeys with the fare agreed before you travel — no surprises at the end."
        icon={Wallet}
        points={[
          { icon: Check, label: "Fare shown upfront, before you request" },
          { icon: Route, label: "Private or shared, up to three riders" },
          { icon: Receipt, label: "A receipt for every completed journey" },
          { icon: BadgeCheck, label: "Verified driver and vehicle" },
          { icon: Star, label: "Live tracking throughout the trip" },
        ]}
        cta={{ href: "/signup", label: "Explore Professional Rides" }}
        delay={0.1}
      />
    </div>
  );
}
