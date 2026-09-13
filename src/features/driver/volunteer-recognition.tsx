"use client";

import { motion } from "motion/react";
import { Award, Clock, Route, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardHeader, NestedTile } from "@/components/ui/card";
import { CountUp } from "@/components/ui/stats-card";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/app-shell";
import { useCurrentDriver } from "./use-current-driver";
import { BadgeTier } from "@/types/enums";
import { formatDate, pluralise } from "@/lib/format";
import { viewportOnce } from "@/lib/motion";
import type { VolunteerBadge } from "@/types/models";

/**
 * Volunteer recognition.
 *
 * Restrained gamification — a record of service rather than points and
 * streaks, and no money anywhere on the page.
 */
const TIER_STYLES: Record<BadgeTier, { ring: string; face: string; label: string }> = {
  [BadgeTier.BRONZE]: {
    ring: "ring-[#b08050]/40",
    face: "bg-gradient-to-br from-[#c89468] to-[#8a5f38] text-white",
    label: "Bronze",
  },
  [BadgeTier.SILVER]: {
    ring: "ring-[#9aa3a0]/45",
    face: "bg-gradient-to-br from-[#c9d1ce] to-[#8b9491] text-forest-950",
    label: "Silver",
  },
  [BadgeTier.GOLD]: {
    ring: "ring-gold-500/45",
    face: "bg-gradient-to-br from-gold-300 to-gold-600 text-forest-950",
    label: "Gold",
  },
  [BadgeTier.PLATINUM]: {
    ring: "ring-forest-400/45",
    face: "bg-gradient-to-br from-forest-200 to-forest-500 text-forest-950",
    label: "Platinum",
  },
};

export function VolunteerRecognition() {
  const { data: driver, isLoading } = useCurrentDriver();

  const service = driver?.service;
  const earned = service?.badges.filter((badge) => badge.earnedAt) ?? [];
  const inProgress = service?.badges.filter((badge) => !badge.earnedAt) ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Volunteer service"
        title="Your service story"
        description="A record of the journeys you've given to members of the community."
      />

      {/* Headline stats */}
      {/* Three across even on a phone — a driver reads these at a glance. */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {[
          {
            icon: Clock,
            label: "Service hours",
            value: service?.serviceHours ?? 0,
          },
          {
            icon: Route,
            label: "Volunteer trips",
            value: service?.volunteerTrips ?? 0,
          },
          {
            icon: Users,
            label: "Passengers served",
            value: service?.passengersServed ?? 0,
          },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="rounded-[var(--kx-radius-lg)] border border-line bg-surface p-3.5 text-center sm:rounded-[var(--kx-radius-xl)] sm:p-6"
            >
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-gold-500/14 text-gold-700 sm:size-11 dark:text-gold-300">
                <Icon className="size-4 sm:size-5" strokeWidth={1.7} aria-hidden />
              </span>
              <p className="type-numeric mt-2.5 text-[1.25rem] leading-none font-semibold text-ink sm:mt-4 sm:text-[1.75rem]">
                {isLoading ? (
                  <span className="kx-skeleton inline-block h-7 w-12 rounded-lg" />
                ) : (
                  <CountUp value={stat.value} />
                )}
              </p>
              <p className="type-micro mt-1.5 text-ink-muted sm:type-meta sm:mt-2">
                {stat.label}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Earned badges */}
      <Card radius="xl" className="mt-5">
        <CardHeader
          title="Recognition earned"
          description={`${earned.length} ${pluralise(earned.length, "badge")} so far.`}
        />

        {earned.length === 0 ? (
          <EmptyState
            icon={Award}
            size="sm"
            className="mt-5"
            title="Every volunteer journey adds to your service story."
            description="Your first badge arrives after your first completed journey."
          />
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {earned.map((badge, index) => (
              <BadgeTile key={badge.id} badge={badge} index={index} />
            ))}
          </ul>
        )}
      </Card>

      {/* Working towards */}
      {inProgress.length > 0 ? (
        <Card radius="xl" className="mt-5">
          <CardHeader
            title="Working towards"
            description="Recognition still ahead of you."
          />

          <ul className="mt-5 space-y-4">
            {inProgress.map((badge) => (
              <li key={badge.id}>
                <NestedTile>
                  <div className="flex items-center gap-3.5">
                    <span
                      className={cn(
                        "inline-flex size-10 shrink-0 items-center justify-center rounded-full opacity-45 ring-1",
                        TIER_STYLES[badge.tier].face,
                        TIER_STYLES[badge.tier].ring,
                      )}
                    >
                      <Award className="size-5" strokeWidth={1.6} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="type-body font-medium text-ink">
                        {badge.name}
                      </p>
                      <p className="type-meta text-ink-muted">
                        {badge.description}
                      </p>
                    </div>
                  </div>

                  {badge.progress ? (
                    <div className="mt-3.5">
                      <ProgressBar
                        value={badge.progress.current / badge.progress.target}
                        label={`${badge.progress.current} of ${badge.progress.target} passengers served`}
                        showValue={false}
                        size="sm"
                      />
                      <p className="type-meta mt-2 text-ink-muted">
                        <span className="type-numeric font-semibold text-ink">
                          {badge.progress.current}
                        </span>{" "}
                        of {badge.progress.target} · {" "}
                        {badge.progress.target - badge.progress.current} to go
                      </p>
                    </div>
                  ) : null}
                </NestedTile>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="type-meta mt-6 text-center text-ink-muted">
        Recognition reflects service given, not money earned. Volunteer
        journeys never involve a fare.
      </p>
    </div>
  );
}

function BadgeTile({ badge, index }: { badge: VolunteerBadge; index: number }) {
  const tier = TIER_STYLES[badge.tier];

  return (
    <motion.li
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={viewportOnce}
      transition={{ duration: 0.42, delay: index * 0.07 }}
      className="flex items-start gap-4 rounded-[var(--kx-radius-lg)] border border-line bg-surface-nested p-5"
    >
      <span
        className={cn(
          "inline-flex size-12 shrink-0 items-center justify-center rounded-full shadow-sm ring-2",
          tier.face,
          tier.ring,
        )}
      >
        <Award className="size-6" strokeWidth={1.7} aria-hidden />
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="type-card-title text-ink">{badge.name}</p>
          <span className="type-micro text-ink-muted">{tier.label}</span>
        </div>
        <p className="type-meta mt-1 text-ink-secondary">{badge.description}</p>
        {badge.earnedAt ? (
          <p className="type-meta mt-2 text-ink-muted">
            Earned {formatDate(badge.earnedAt)}
          </p>
        ) : null}
      </div>
    </motion.li>
  );
}
