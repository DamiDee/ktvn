"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  MapPin,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardHeader, NestedTile } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge, VerifiedBadge } from "@/components/ui/badge";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { ProgressBar } from "@/components/ui/progress";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/app-shell";
import { DocumentUpload } from "@/components/verification/document-upload";
import { queryKeys } from "@/constants/query-keys";
import { verificationService } from "@/services";
import {
  DOCUMENT_STATUS_PRESENTATION,
  TRACK_LABEL,
  VERIFICATION_PRESENTATION,
} from "@/constants/status-presentation";
import {
  isVerificationComplete,
  verificationNeedsApplicantAction,
  verificationProgress,
} from "@/lib/state-machines";
import { DocumentStatus, VerificationStatus } from "@/types/enums";
import { formatDate, formatDateTime } from "@/lib/format";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

/**
 * Where a driver's application has got to.
 *
 * Every state says something specific — "Your driver's licence is being
 * reviewed", not "Pending" — and anything needing the driver's action is
 * surfaced with the document that caused it.
 */
export function VerificationProgress() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.driver.verification(),
    queryFn: () => verificationService.getMyVerification(),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Card radius="xl" className="mt-6">
          <SkeletonText lines={4} />
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          title="We couldn't load your application."
          description="Your progress is safe — this is just a problem fetching it."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const presentation = VERIFICATION_PRESENTATION[data.status];
  const approved = isVerificationComplete(data.status);
  const needsAction = verificationNeedsApplicantAction(data.status);

  const timelineItems: TimelineItem[] = data.steps.map((step) => ({
    id: step.id,
    label: step.label,
    description: step.description,
    meta: step.completedAt ? formatDate(step.completedAt) : undefined,
    state: step.status,
  }));

  const attentionDocuments = data.documents.filter(
    (doc) =>
      doc.status === DocumentStatus.NEEDS_ATTENTION ||
      doc.status === DocumentStatus.EXPIRED ||
      doc.status === DocumentStatus.MISSING,
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Verification"
        title={approved ? "You're a verified driver." : "Your application"}
        description={presentation.detail}
        action={<StatusBadge presentation={presentation} size="md" />}
      />

      {approved ? <ApprovedBanner track={TRACK_LABEL[data.track]} /> : null}

      <div className="space-y-5">
        {/* Progress */}
        {!approved ? (
          <Card radius="xl">
            <CardHeader
              title="Progress"
              description={`Submitted ${data.submittedAt ? formatDateTime(data.submittedAt) : "recently"} · ${TRACK_LABEL[data.track]} track`}
            />
            <ProgressBar
              value={verificationProgress(data.status)}
              label="Verification progress"
              showValue
              className="mt-5"
            />
          </Card>
        ) : null}

        {/* Timeline */}
        <Card radius="xl">
          <CardHeader
            title="Where things stand"
            description="Both tracks pass the same five checks."
          />
          <Timeline items={timelineItems} className="mt-6" />
        </Card>

        {/* Changes required */}
        {needsAction || attentionDocuments.length > 0 ? (
          <Card
            radius="xl"
            className="border-gold-300/60 bg-pending-50/40 dark:border-gold-700/30 dark:bg-gold-500/6"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-500/18 text-gold-700 dark:text-gold-300">
                <AlertTriangle className="size-4.5" strokeWidth={1.9} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="type-card-title text-ink">Needs your attention</p>
                <p className="type-meta mt-1 text-ink-secondary">
                  {data.changesRequested?.length
                    ? "Sort these out and we'll pick the review back up."
                    : "One document needs a clearer copy before the review can finish."}
                </p>
              </div>
            </div>

            {data.changesRequested?.length ? (
              <ul className="mt-4 space-y-2">
                {data.changesRequested.map((change) => (
                  <li key={change} className="flex items-start gap-2.5">
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold-600"
                      aria-hidden
                    />
                    <span className="type-body text-ink-secondary">{change}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {attentionDocuments.length > 0 ? (
              <div className="mt-5 space-y-3">
                {attentionDocuments.map((doc) => (
                  <DocumentUpload
                    key={doc.id}
                    type={doc.type}
                    label={doc.label}
                    document={doc}
                  />
                ))}
              </div>
            ) : null}
          </Card>
        ) : null}

        {/* Physical inspection */}
        <InspectionCard inspection={data.inspection} status={data.status} />

        {/* All documents */}
        <Card radius="xl">
          <CardHeader
            title="Your documents"
            description="What the verification team has on file."
          />
          <ul className="mt-5 divide-y divide-line">
            {data.documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="type-body truncate font-medium text-ink">
                    {doc.label}
                  </p>
                  <p className="type-meta truncate text-ink-muted">
                    {doc.fileName ?? "Not uploaded"}
                    {doc.expiresAt ? ` · expires ${formatDate(doc.expiresAt)}` : ""}
                  </p>
                </div>
                <StatusBadge
                  presentation={
                    DOCUMENT_STATUS_PRESENTATION[doc.status] ?? {
                      label: doc.status,
                      tone: "neutral",
                    }
                  }
                />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/** Approved: a restrained gold flourish, not confetti everywhere. */
function ApprovedBanner({ track }: { track: string }) {
  const { prefersReduced } = useReducedMotionSafe();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-5 overflow-hidden rounded-[var(--kx-radius-xl)] border border-gold-300/60 bg-gradient-to-br from-gold-50 to-surface p-6 dark:border-gold-700/35 dark:from-gold-500/10 dark:to-surface"
    >
      {/* A few restrained particles, only when motion is welcome */}
      {!prefersReduced
        ? Array.from({ length: 10 }).map((_, index) => (
            <motion.span
              key={index}
              className="absolute size-1.5 rounded-full bg-gold-500"
              style={{ left: `${8 + index * 9}%`, top: "50%" }}
              initial={{ opacity: 0, y: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                y: [-4, -34 - (index % 3) * 12],
                scale: [0, 1, 0.4],
              }}
              transition={{
                duration: 1.4,
                delay: 0.25 + index * 0.05,
                ease: "easeOut",
              }}
              aria-hidden
            />
          ))
        : null}

      <div className="relative flex items-start gap-4">
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-gold-500 text-forest-950"
        >
          <Check className="size-6" strokeWidth={2.8} aria-hidden />
        </motion.span>

        <div className="min-w-0">
          <p className="type-section-title text-ink">Approved</p>
          <p className="type-body mt-1.5 text-ink-secondary">
            Your documents and vehicle have both passed. You can start accepting
            passengers on the {track.toLowerCase()} track.
          </p>
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <VerifiedBadge label="Verified Driver" size="md" />
            <VerifiedBadge label="Vehicle Verified" tone="gold" size="md" />
          </div>
          <ButtonLink href="/driver" variant="primary" size="md" className="mt-5">
            Go to your dashboard
          </ButtonLink>
        </div>
      </div>
    </motion.div>
  );
}

function InspectionCard({
  inspection,
  status,
}: {
  inspection: { required: boolean; scheduled: boolean; scheduledAt?: string; location?: string; note?: string };
  status: VerificationStatus;
}) {
  if (!inspection.required) return null;

  const done =
    status === VerificationStatus.APPROVED ||
    status === VerificationStatus.FINAL_REVIEW;

  return (
    <Card radius="xl">
      <div className="flex items-start gap-3.5">
        <span
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-full",
            done
              ? "bg-success-50 text-success-700 dark:bg-success-500/14 dark:text-emerald-300"
              : "bg-surface-nested text-ink-secondary",
          )}
        >
          {done ? (
            <Check className="size-5" strokeWidth={2.4} aria-hidden />
          ) : (
            <Wrench className="size-5" strokeWidth={1.7} aria-hidden />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="type-card-title text-ink">Physical inspection</p>
            <StatusBadge
              presentation={{
                label: done
                  ? "Passed"
                  : inspection.scheduled
                    ? "Scheduled"
                    : "Required",
                tone: done ? "success" : inspection.scheduled ? "info" : "pending",
              }}
            />
          </div>

          {inspection.scheduled && inspection.scheduledAt ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <NestedTile>
                <div className="flex items-center gap-2">
                  <CalendarClock
                    className="size-4 text-ink-muted"
                    strokeWidth={1.7}
                    aria-hidden
                  />
                  <p className="type-micro text-ink-muted">When</p>
                </div>
                <p className="type-body mt-1.5 font-medium text-ink">
                  {formatDateTime(inspection.scheduledAt)}
                </p>
              </NestedTile>

              <NestedTile>
                <div className="flex items-center gap-2">
                  <MapPin
                    className="size-4 text-ink-muted"
                    strokeWidth={1.7}
                    aria-hidden
                  />
                  <p className="type-micro text-ink-muted">Where</p>
                </div>
                <p className="type-body mt-1.5 font-medium text-ink">
                  {inspection.location ?? "To be confirmed"}
                </p>
              </NestedTile>
            </div>
          ) : (
            <p className="type-body mt-2 text-ink-secondary">
              {inspection.note ??
                "The verification team will contact you with inspection details."}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
