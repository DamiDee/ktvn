"use client";

import { motion } from "motion/react";
import {
  Award,
  ChevronDown,
  Clock,
  Inbox,
  Radio,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CountUp } from "@/components/ui/stats-card";
import { StatusChip } from "@/components/ui/badge";
import { formatNaira } from "@/lib/format";
import { CURRENT_DRIVER, DRIVERS } from "@/mocks/people";
import { viewportOnce } from "@/lib/motion";

/**
 * Side-by-side preview of the two driver dashboards. The volunteer panel is
 * service-oriented; the professional panel is operational and financial.
 */
export function DriverPreview() {
  const volunteer = CURRENT_DRIVER.service;
  const professional = DRIVERS[0].earningsSummary;

  return (
    <div className="mt-9 grid gap-5 sm:mt-11 lg:grid-cols-2">
      <PreviewCard
        eyebrow="Volunteer dashboard"
        title="Service, not settlement"
        tone="gold"
        delay={0}
      >
        <div className="rounded-[var(--kx-radius-md)] border border-line bg-surface p-4">
          <p className="type-card-title text-ink">
            Are you available after tonight&rsquo;s service?
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <MiniStat label="Vehicle" value="Toyota Corolla" />
            <MiniStat label="Destination" value="Gwarinpa" />
            <MiniStat label="Availability" value="3 seats" />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <StatTile
            icon={Clock}
            label="Service hours"
            value={volunteer?.serviceHours ?? 0}
          />
          <StatTile
            icon={Radio}
            label="Volunteer trips"
            value={volunteer?.volunteerTrips ?? 0}
          />
          <StatTile
            icon={Award}
            label="Passengers served"
            value={volunteer?.passengersServed ?? 0}
          />
        </div>
      </PreviewCard>

      <PreviewCard
        eyebrow="Professional dashboard"
        title="Requests, trips and earnings"
        tone="lilac"
        delay={0.1}
      >
        <div className="rounded-[var(--kx-radius-md)] border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="type-micro text-ink-muted">Status</p>
              <p className="type-card-title mt-1 text-ink">You&rsquo;re online</p>
            </div>
            <StatusChip tone="active" dot live>
              Accepting requests
            </StatusChip>
          </div>

          <div className="mt-3 flex items-center gap-2.5 rounded-[var(--kx-radius-sm)] bg-surface-nested px-3.5 py-2.5">
            <Inbox className="size-4 shrink-0 text-ink-muted" strokeWidth={1.8} aria-hidden />
            <p className="type-meta text-ink-secondary">
              1 request waiting · Wuse II · +4 min from your route
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <StatTile
            icon={TrendingUp}
            label="This week"
            value={professional?.weekToDate ?? 0}
            display={formatNaira(professional?.weekToDate ?? 0)}
          />
          <StatTile icon={Radio} label="Trips" value={professional?.weekTrips ?? 0} />
          <StatTile
            icon={Receipt}
            label="Receipts"
            value={professional?.weekTrips ?? 0}
          />
        </div>

        <p className="type-meta mt-3 text-ink-muted">
          Earnings are a record of completed rides, not a wallet or a balance
          you draw from.
        </p>
      </PreviewCard>
    </div>
  );
}

function PreviewCard({
  eyebrow,
  title,
  tone,
  delay,
  children,
}: {
  eyebrow: string;
  title: string;
  tone: "gold" | "lilac";
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.details
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewportOnce}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group overflow-hidden rounded-[var(--kx-radius-2xl)] border",
        tone === "gold"
          ? "border-gold-200/70 bg-gold-50/50 dark:border-gold-700/25 dark:bg-gold-500/6"
          : "border-lilac-200/60 bg-lilac-50/50 dark:border-lilac-700/25 dark:bg-lilac-500/6",
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 outline-none transition-colors hover:bg-surface/50 focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-inset sm:p-6 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="type-micro block text-ink-muted">{eyebrow}</span>
          <span className="type-card-title mt-1.5 block text-[1.125rem] text-ink">
            {title}
          </span>
        </span>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink-muted ring-1 ring-line">
          <ChevronDown
            className="size-4 transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          />
        </span>
      </summary>
      <div className="border-t border-line p-5 sm:p-6">{children}</div>
    </motion.details>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="type-micro text-ink-muted">{label}</p>
      <p className="type-meta mt-1 truncate font-medium text-ink">{value}</p>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  display,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  display?: string;
}) {
  return (
    <div className="rounded-[var(--kx-radius-md)] border border-line bg-surface p-3.5">
      <Icon className="size-4 text-ink-muted" strokeWidth={1.7} aria-hidden />
      <p className="mt-2.5 text-[1.125rem] leading-none font-semibold text-ink">
        {display ?? <CountUp value={value} />}
      </p>
      <p className="type-micro mt-1.5 text-ink-muted">{label}</p>
    </div>
  );
}
