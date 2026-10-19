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
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/app-shell";
import { BarChart } from "@/components/analytics/bar-chart";
import { queryKeys } from "@/constants/query-keys";
import { adminData, type Period } from "./data/admin-data";
import { formatCompactNumber, formatNaira } from "@/lib/format";
import type { LucideIcon } from "lucide-react";


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
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.reports(period),
    queryFn: () => adminData.listReports(period),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Control centre"
        title="Reports"
        description="How the network is doing — adoption, verification, journeys, safety, ratings and retention."
        action={
          <Button
            variant="secondary"
            size="md"
            icon={Download}
            loading={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                const result = await adminData.exportReports(period);
                toast(
                  result === "downloaded"
                    ? { title: "Report downloaded", description: `${PERIOD_LABEL[period]} as a CSV file.` }
                    : { title: "Report export queued", description: `${PERIOD_LABEL[period]} will be emailed to you as a CSV.` },
                );
              } catch (error) {
                toast({ title: "The export didn't download.", description: error instanceof Error ? error.message : undefined, tone: "danger" });
              } finally {
                setExporting(false);
              }
            }}
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
          {data.filter((section) => section.id !== "savings").map((section) => {
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
                  description={section.id === "ratings" ? "Two-way ratings from the network." : section.description}
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
