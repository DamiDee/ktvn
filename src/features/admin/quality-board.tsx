"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Flag, MessageSquare, Star } from "lucide-react";
import { Card, NestedTile } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusChip } from "@/components/ui/badge";
import { RatingValue } from "@/components/ui/rating";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ListSkeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/app-shell";
import { queryKeys } from "@/constants/query-keys";
import { adminService } from "@/services";
import { TRACK_LABEL, TRACK_TONE } from "@/constants/status-presentation";
import { UserRole } from "@/types/enums";
import { formatRelativeTime, pluralise } from "@/lib/format";
import type { QualityFlag } from "@/types/models";

/**
 * Quality.
 *
 * Ratings are a signal, not a verdict — a flag opens a conversation before it
 * ever changes someone's standing, and the same threshold applies on both
 * tracks.
 */
export function QualityBoard() {
  const { toast } = useToast();
  const [reviewing, setReviewing] = useState<QualityFlag | null>(null);
  const [cleared, setCleared] = useState<string[]>([]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.quality(),
    queryFn: () => adminService.listQualityFlags(),
  });

  const flags = (data ?? []).filter((flag) => !cleared.includes(flag.id));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Quality"
        title="Ratings and conduct"
        description="Drivers and members whose recent ratings need a closer look."
        action={
          <StatusChip
            tone={flags.length > 0 ? "pending" : "success"}
            dot
            size="md"
          >
            {flags.length} {pluralise(flags.length, "flag")}
          </StatusChip>
        }
      />

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <ErrorState
          title="We couldn't load the quality board."
          onRetry={() => refetch()}
        />
      ) : flags.length === 0 ? (
        <Card radius="xl">
          <EmptyState
            icon={BadgeCheck}
            title="Nothing needs attention."
            description="No driver or member has fallen below the rating threshold this week."
          />
        </Card>
      ) : (
        <ul className="space-y-4">
          {flags.map((flag) => (
            <li key={flag.id}>
              <Card radius="xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <Avatar
                      name={flag.subjectName}
                      src={flag.subjectAvatarUrl}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <p className="type-card-title truncate text-ink">
                        {flag.subjectName}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusChip tone="neutral">
                          {flag.role === UserRole.DRIVER
                            ? "Driver"
                            : "Passenger"}
                        </StatusChip>
                        {flag.track ? (
                          <StatusChip tone={TRACK_TONE[flag.track]}>
                            {TRACK_LABEL[flag.track]}
                          </StatusChip>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                    <RatingValue value={flag.averageRating} />
                    <span className="type-meta text-ink-muted">
                      flagged {formatRelativeTime(flag.flaggedAt)}
                    </span>
                  </div>
                </div>

                <NestedTile className="mt-4">
                  <p className="type-meta text-ink-secondary">{flag.reason}</p>
                </NestedTile>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <NestedTile>
                    <p className="type-micro text-ink-muted">Average rating</p>
                    <p className="type-numeric mt-1.5 inline-flex items-center gap-1 text-[1rem] font-semibold text-ink">
                      <Star
                        className="size-3.5 text-gold-500"
                        strokeWidth={2}
                        fill="currentColor"
                        aria-hidden
                      />
                      {flag.averageRating.toFixed(1)}
                    </p>
                    <ProgressBar
                      value={flag.averageRating / 5}
                      label={`${flag.subjectName} average rating`}
                      className="mt-2.5"
                      tone={flag.averageRating < 3 ? "lilac" : "gold"}
                    />
                  </NestedTile>

                  <NestedTile>
                    <p className="type-micro text-ink-muted">Low ratings</p>
                    <p className="type-numeric mt-1.5 text-[1rem] font-semibold text-ink">
                      {flag.lowRatings}
                    </p>
                    <p className="type-meta mt-1 text-ink-muted">
                      out of {flag.trips} {pluralise(flag.trips, "trip")}
                    </p>
                  </NestedTile>

                  <NestedTile>
                    <p className="type-micro text-ink-muted">Threshold</p>
                    <p className="type-numeric mt-1.5 text-[1rem] font-semibold text-ink">
                      3.0
                    </p>
                    <p className="type-meta mt-1 text-ink-muted">
                      Same on both tracks
                    </p>
                  </NestedTile>
                </div>

                <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                  <Button
                    variant="secondary"
                    size="lg"
                    icon={MessageSquare}
                    className="sm:flex-1"
                    onClick={() =>
                      toast({
                        title: `Conversation opened with ${flag.subjectName}`,
                        description:
                          "A member of the team will speak with them this week.",
                      })
                    }
                  >
                    Open conversation
                  </Button>

                  <ButtonLink
                    href={
                      flag.role === UserRole.DRIVER
                        ? `/admin/drivers/${flag.subjectId}`
                        : `/admin/passengers/${flag.subjectId}`
                    }
                    variant="secondary"
                    size="lg"
                    icon={Flag}
                    className="sm:flex-1"
                  >
                    View record
                  </ButtonLink>

                  <Button
                    variant="ghost"
                    size="lg"
                    className="sm:flex-1"
                    onClick={() => setReviewing(flag)}
                  >
                    Clear flag
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="type-meta mt-5 text-ink-muted">
        A flag is a prompt for a conversation, not a penalty. Nothing here
        changes a driver&rsquo;s standing until someone from the team has
        spoken with them.
      </p>

      <ConfirmDialog
        open={reviewing !== null}
        onClose={() => setReviewing(null)}
        onConfirm={() => {
          if (reviewing) {
            setCleared((current) => [...current, reviewing.id]);
            toast({
              title: `Flag cleared for ${reviewing.subjectName}`,
              tone: "success",
            });
          }
          setReviewing(null);
        }}
        title="Clear this flag?"
        description="Clear it once the conversation has happened and the team is satisfied. The ratings themselves stay on the record."
        confirmLabel="Clear flag"
      />
    </div>
  );
}
