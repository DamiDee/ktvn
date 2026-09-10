"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Download,
  HeartHandshake,
  Repeat,
  ShieldAlert,
  Star,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/ui/stats-card";
import { StatsCardSkeleton } from "@/components/ui/skeleton";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusChip } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/app-shell";
import { BarChart } from "@/components/analytics/bar-chart";
import { queryKeys } from "@/constants/query-keys";
import { adminService } from "@/services";
import { formatCompactNumber, formatNaira } from "@/lib/format";
import type { LucideIcon } from "lucide-react";

type Period = "WEEK" | "MONTH" | "QUARTER";

const PERIOD_LABEL: Record<Period, string> = {
  WEEK: "Last 7 days",
  MONTH: "Last 30 days",
  QUARTER: "Last 90 days",
};

const SECTION_ICON: Record<string, LucideIcon> = {
  adoption: TrendingUp,
  verification: UserCheck,
  performance: BarChart3,
  safety: ShieldAlert,
  ratings: Star,
  savings: HeartHandshake,
  retention: Repeat,
};

const SECTION_SERIES_LABELS: Record<string, [string, string?]> = {
  adoption: ["Rides requested", "Rides completed"],
  verification: ["Days to verify"],
  performance: ["Match rate %"],
  safety: ["Incidents opened"],
  ratings: ["Average rating"],
  savings: ["Saving to members"],
  retention: ["Repeat passengers %"],
};

/**
 * Reports.
 *
 * Every section is a card that stacks on a phone, and each chart is paired
 * with the same numbers as text so the figures never depend on being able to
 * read a chart.
 */
export function Reports() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("MONTH");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.reports(),
    queryFn: () => adminService.listReports(),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Control centre"
        title="Reports"
        description="How the network is doing — adoption, verification, journeys, safety, ratings, service and retention."
        action={
          <Button
            variant="secondary"
            size="md"
            icon={Download}
            onClick={() =>
              toast({
                title: "Report export queued",
                description: `${PERIOD_LABEL[period]} will be emailed to you as a CSV.`,
              })
            }
          >
            Export
          </Button>
        }
      />

      <FilterBar
        label="Reporting period"
        value={period}
        onChange={setPeriod}
        className="mb-5"
        options={[
          { value: "WEEK", label: PERIOD_LABEL.WEEK },
          { value: "MONTH", label: PERIOD_LABEL.MONTH },
          { value: "QUARTER", label: PERIOD_LABEL.QUARTER },
        ]}
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <StatsCardSkeleton key={index} />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState
          title="We couldn't load reports."
          onRetry={() => refetch()}
        />
      ) : (
        <div className="space-y-5">
          {data.map((section) => {
            const money = section.id === "savings";
            const Icon = SECTION_ICON[section.id];

            return (
              <Card key={section.id} radius="xl">
                <CardHeader
                  eyebrow={
                    <span className="inline-flex items-center gap-1.5">
                      {Icon ? (
                        <Icon
                          className="size-3.5"
                          strokeWidth={1.9}
                          aria-hidden
                        />
                      ) : null}
                      {PERIOD_LABEL[period]}
                    </span>
                  }
                  title={section.title}
                  description={section.description}
                />

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {section.metrics.map((metric) => (
                    <StatsCard
                      key={metric.id}
                      label={metric.label}
                      value={metric.display ?? metric.value}
                      deltaPercent={metric.deltaPercent}
                      accent={
                        metric.intent === "critical"
                          ? "lilac"
                          : metric.intent === "attention"
                            ? "gold"
                            : "neutral"
                      }
                    />
                  ))}
                </div>

                {section.series && section.series.length > 0 ? (
                  <div className="mt-5">
                    <BarChart
                      data={section.series}
                      caption={`${section.title} over ${PERIOD_LABEL[period].toLowerCase()}`}
                      seriesLabels={SECTION_SERIES_LABELS[section.id]}
                      accent={money ? "gold" : "lilac"}
                      height={150}
                      formatValue={(value) =>
                        money
                          ? formatNaira(value)
                          : value >= 1000
                            ? formatCompactNumber(value)
                            : String(value)
                      }
                    />
                  </div>
                ) : null}

                {money ? (
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <StatusChip tone="success">Volunteer track</StatusChip>
                    <p className="type-meta min-w-0 flex-1 text-ink-muted">
                      An estimate of what these journeys would have cost on the
                      professional track. No volunteer driver is paid, and no
                      fare is ever shown on a volunteer ride.
                    </p>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <p className="type-meta mt-5 text-ink-muted">
        Figures compare against the previous period of the same length. Safety
        reporting measures response, not risk — verification reduces risk
        rather than removing it.
      </p>
    </div>
  );
}
