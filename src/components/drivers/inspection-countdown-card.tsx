"use client";

import { AlertTriangle, CalendarClock, MapPin } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/badge";
import { InspectionStatus } from "@/types/enums";
import type { VehicleInspection } from "@/types/models";
import { formatDate, formatDateTime } from "@/lib/format";

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

export function InspectionCountdownCard({
  inspection,
}: {
  inspection?: VehicleInspection;
}) {
  if (!inspection) return null;

  const remaining = daysUntil(inspection.nextDueAt);
  const urgent = remaining <= 14 || remaining < 0;
  const missed = inspection.status === InspectionStatus.MISSED;

  return (
    <Card radius="xl" className={missed ? "border-danger-500/35" : undefined}>
      <CardHeader
        eyebrow="3-month vehicle check"
        title={missed ? "Inspection missed" : "Next inspection"}
        description={
          missed
            ? "Driving access is paused until the oversight team reviews your vehicle."
            : `Due ${formatDate(inspection.nextDueAt)}`
        }
        action={
          <StatusChip tone={missed || urgent ? "danger" : "success"} size="sm">
            {missed
              ? "Missed"
              : remaining < 0
                ? `${Math.abs(remaining)}d overdue`
                : `${remaining} day${remaining === 1 ? "" : "s"} left`}
          </StatusChip>
        }
      />

      {inspection.scheduledAt ? (
        <div className="mt-4 rounded-[var(--kx-radius-md)] bg-surface-nested p-4">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-4.5 shrink-0 text-forest-700 dark:text-gold-300" />
            <div>
              <p className="type-meta font-semibold text-ink">
                {formatDateTime(inspection.scheduledAt)}
              </p>
              {inspection.location ? (
                <p className="type-meta mt-1 flex items-center gap-1.5 text-ink-secondary">
                  <MapPin className="size-3.5" aria-hidden />
                  {inspection.location}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : urgent && !missed ? (
        <p className="type-meta mt-4 flex items-start gap-2 rounded-[var(--kx-radius-md)] bg-gold-50 p-3 text-gold-900 dark:bg-gold-500/10 dark:text-gold-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Contact the inspection desk to book a slot before the deadline.
        </p>
      ) : null}
    </Card>
  );
}
