"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Clock, HandHeart, Info, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardHeader, NestedTile } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, VerifiedBadge } from "@/components/ui/badge";
import { Timeline } from "@/components/ui/timeline";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { SafetyNote } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/app-shell";
import {
  TRACK_DESCRIPTION,
  TRACK_LABEL,
  TRACK_SWITCH_PRESENTATION,
} from "@/constants/status-presentation";
import { DriverTrack, TrackSwitchStatus } from "@/types/enums";
import { formatDateTime } from "@/lib/format";
import { transitions } from "@/lib/motion";
import type { Driver } from "@/types/models";

/**
 * Track switching.
 *
 * Product Rule 6: this is a request that goes to the verification team, not a
 * toggle. The UI never shows a control that would flip the track directly —
 * the only affordance is "request", and afterwards the state is read-only
 * until a decision comes back.
 */
export function TrackSwitch({ driver }: { driver: Driver }) {
  const { toast } = useToast();

  const [request, setRequest] = useState(driver.trackSwitch);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentTrack = driver.track;
  const targetTrack =
    currentTrack === DriverTrack.VOLUNTEER
      ? DriverTrack.PROFESSIONAL
      : DriverTrack.VOLUNTEER;

  const status = request?.status ?? TrackSwitchStatus.NONE;
  const pending =
    status === TrackSwitchStatus.REQUESTED ||
    status === TrackSwitchStatus.UNDER_REVIEW;

  async function submitRequest() {
    setSubmitting(true);
    // A real submission would post to the verification service here.
    await new Promise((resolve) => setTimeout(resolve, 700));

    setRequest({
      id: "tsr-new",
      fromTrack: currentTrack,
      toTrack: targetTrack,
      status: TrackSwitchStatus.REQUESTED,
      requestedAt: new Date().toISOString(),
    });

    setSubmitting(false);
    setConfirming(false);
    toast({
      title: "Switch requested",
      description: "The verification team will review and come back to you.",
      tone: "success",
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Driver track"
        title="Your track"
        description="Both tracks share the same verification standard. Moving between them needs approval."
      />

      <div className="space-y-5">
        {/* Current track */}
        <Card radius="xl">
          <CardHeader
            eyebrow="Current driver track"
            title={`${TRACK_LABEL[currentTrack]} driver`}
            description={TRACK_DESCRIPTION[currentTrack]}
            action={
              <VerifiedBadge
                label="Verified Driver"
                tone={
                  currentTrack === DriverTrack.VOLUNTEER ? "gold" : "lilac"
                }
                size="md"
              />
            }
          />

          <NestedTile className="mt-5 flex items-center gap-3.5">
            <span
              className={cn(
                "inline-flex size-10 shrink-0 items-center justify-center rounded-full",
                currentTrack === DriverTrack.VOLUNTEER
                  ? "bg-gold-500/16 text-gold-700 dark:text-gold-300"
                  : "bg-lilac-500/16 text-lilac-700 dark:text-lilac-300",
              )}
            >
              {currentTrack === DriverTrack.VOLUNTEER ? (
                <HandHeart className="size-5" strokeWidth={1.7} aria-hidden />
              ) : (
                <Wallet className="size-5" strokeWidth={1.7} aria-hidden />
              )}
            </span>
            <p className="type-meta text-ink-secondary">
              {currentTrack === DriverTrack.VOLUNTEER
                ? "You offer seats freely. No fare is charged on your journeys and no payment is collected."
                : "You provide paid journeys with the fare agreed upfront, and a receipt for each one."}
            </p>
          </NestedTile>
        </Card>

        {/* Request state, or the request affordance */}
        <AnimatePresence mode="wait">
          {status === TrackSwitchStatus.NONE ? (
            <motion.div
              key="request"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={transitions.card}
            >
              <Card radius="xl">
                <CardHeader
                  title={`Switch to ${TRACK_LABEL[targetTrack]}?`}
                  description={TRACK_DESCRIPTION[targetTrack]}
                />

                <SafetyNote className="mt-5">
                  Switching isn&rsquo;t instant. The verification team reviews
                  the request against the requirements of the track you&rsquo;re
                  moving to, and your current track stays active until they
                  decide.
                </SafetyNote>

                <Button
                  variant="primary"
                  size="lg"
                  block
                  className="mt-5"
                  iconRight={ArrowRight}
                  onClick={() => setConfirming(true)}
                >
                  Request switch to {TRACK_LABEL[targetTrack]}
                </Button>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="status"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transitions.card}
            >
              <Card radius="xl">
                <CardHeader
                  eyebrow="Switch request"
                  title={`${TRACK_LABEL[request!.fromTrack]} → ${TRACK_LABEL[request!.toTrack]}`}
                  description={
                    TRACK_SWITCH_PRESENTATION[status].detail ??
                    TRACK_SWITCH_PRESENTATION[status].label
                  }
                  action={
                    <StatusBadge
                      presentation={TRACK_SWITCH_PRESENTATION[status]}
                      live={pending}
                      size="md"
                    />
                  }
                />

                <Timeline
                  className="mt-6"
                  items={[
                    {
                      id: "requested",
                      label: "Request submitted",
                      description: "You asked to change track.",
                      meta: request?.requestedAt
                        ? formatDateTime(request.requestedAt)
                        : undefined,
                      state: "COMPLETE",
                    },
                    {
                      id: "review",
                      label: "Verification review",
                      description:
                        "The team checks your documents against the new track's requirements.",
                      state:
                        status === TrackSwitchStatus.REQUESTED ||
                        status === TrackSwitchStatus.UNDER_REVIEW
                          ? "ACTIVE"
                          : "COMPLETE",
                    },
                    {
                      id: "decision",
                      label: "Decision",
                      description:
                        status === TrackSwitchStatus.APPROVED
                          ? "Your new track is active."
                          : status === TrackSwitchStatus.DECLINED
                            ? "The request wasn't approved."
                            : "You'll be notified either way.",
                      meta: request?.decidedAt
                        ? formatDateTime(request.decidedAt)
                        : undefined,
                      state:
                        status === TrackSwitchStatus.APPROVED
                          ? "COMPLETE"
                          : status === TrackSwitchStatus.DECLINED
                            ? "BLOCKED"
                            : "PENDING",
                    },
                  ]}
                />

                {pending ? (
                  <div className="mt-5 flex items-start gap-2.5 rounded-[var(--kx-radius-md)] bg-surface-nested p-4">
                    <Clock
                      className="mt-0.5 size-4 shrink-0 text-ink-muted"
                      strokeWidth={1.8}
                      aria-hidden
                    />
                    <p className="type-meta text-ink-secondary">
                      You&rsquo;re still driving on the{" "}
                      {TRACK_LABEL[currentTrack].toLowerCase()} track while this
                      is reviewed. Nothing about your current journeys changes.
                    </p>
                  </div>
                ) : null}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-start gap-3 rounded-[var(--kx-radius-md)] border border-line bg-surface-nested p-4">
          <Info
            className="mt-0.5 size-4 shrink-0 text-ink-muted"
            strokeWidth={1.8}
            aria-hidden
          />
          <p className="type-meta text-ink-secondary">
            Whichever track you drive on, the verification standard is the same:
            member identity, driver licence, vehicle documents and a physical
            inspection.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={submitRequest}
        loading={submitting}
        title={`Request a switch to ${TRACK_LABEL[targetTrack]}?`}
        description={
          targetTrack === DriverTrack.PROFESSIONAL
            ? "Your journeys would start carrying a fare, with receipts issued to passengers. The verification team reviews this before it takes effect."
            : "Your journeys would stop carrying any fare — they'd be given in service. The verification team reviews this before it takes effect."
        }
        confirmLabel="Send request"
        cancelLabel="Not now"
      />
    </div>
  );
}
