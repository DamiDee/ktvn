"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  MessageSquare,
  Phone,
  Route as RouteIcon,
  UserRound,
} from "lucide-react";
import { Card, CardHeader, DataPoint, NestedTile } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, StatusChip } from "@/components/ui/badge";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/modal";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { PageLoader } from "@/components/ui/route-loader";
import { PageHeader } from "@/components/layout/app-shell";
import { queryKeys } from "@/constants/query-keys";
import { adminData } from "./data/admin-data";
import {
  INCIDENT_CATEGORY_LABEL,
  INCIDENT_SEVERITY_PRESENTATION,
  INCIDENT_STATUS_PRESENTATION,
} from "@/constants/status-presentation";
import { IncidentStatus, UserRole } from "@/types/enums";
import { formatDateTime, formatRelativeTime } from "@/lib/format";

interface Note {
  id: string;
  author: string;
  note: string;
  at: string;
}

/** One incident: what happened, who was involved, and what was done about it. */
export function IncidentDetail({ incidentId }: { incidentId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [extraNotes, setExtraNotes] = useState<Note[]>([]);
  const [resolving, setResolving] = useState(false);
  const [status, setStatus] = useState<IncidentStatus | null>(null);

  const { data: incident, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.incident(incidentId),
    queryFn: () => adminData.getIncident(incidentId),
  });

  if (isLoading) return <PageLoader message="Loading the incident" />;

  if (isError || !incident) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorState
          title="We couldn't find that incident."
          description="It may have been closed, or the link may be out of date."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const currentStatus = status ?? incident.status;
  const resolved = currentStatus === IncidentStatus.RESOLVED;
  const notes = [...incident.adminNotes, ...extraNotes];

  const timeline: TimelineItem[] = [
    ...incident.timeline.map((event, index) => ({
      id: event.id,
      label: event.label,
      description: event.detail,
      meta: formatRelativeTime(event.at),
      state:
        index === incident.timeline.length - 1 && !resolved
          ? ("ACTIVE" as const)
          : ("COMPLETE" as const),
    })),
    ...(resolved && incident.status !== IncidentStatus.RESOLVED
      ? [
          {
            id: "resolved-now",
            label: "Incident resolved",
            description: "Closed by the oversight team",
            meta: "Just now",
            state: "COMPLETE" as const,
          },
        ]
      : []),
  ];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: [queryKeys.admin.root[0], "incidents"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.incident(incidentId) });
  }

  async function run(work: () => Promise<unknown>, success: () => void) {
    setSaving(true);
    try {
      await work();
      success();
      refresh();
    } catch (error) {
      toast({ title: "That didn't save.", description: error instanceof Error ? error.message : undefined, tone: "danger" });
    } finally {
      setSaving(false);
    }
  }

  function addNote() {
    const text = draft.trim();
    if (!text) return;
    void run(async () => {
      const note = await adminData.addIncidentNote(incidentId, text);
      setExtraNotes((current) => [...current, note]);
    }, () => {
      setDraft("");
      toast({ title: "Note added to the incident" });
    });
  }

  function moveTo(next: IncidentStatus, title: string, description?: string) {
    void run(() => adminData.updateIncidentStatus(incidentId, next), () => {
      setStatus(next);
      toast({ title, description, tone: next === IncidentStatus.RESOLVED ? "success" : undefined });
    });
  }

  function call(person: { id: string; name: string; phone?: string }) {
    void run(async () => {
      const result = await adminData.callParticipant(incidentId, person.id);
      const phone = result.phone ?? person.phone;
      if (phone) setPhones((current) => ({ ...current, [person.id]: phone }));
      const href = result.callHref ?? (phone ? `tel:${phone.replace(/\s+/g, "")}` : undefined);
      if (href) window.location.href = href;
    }, () => toast({ title: `Calling ${person.name}`, description: "The call is logged against this incident." }));
  }


  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/incidents"
        className="kx-tap type-meta mb-4 inline-flex items-center gap-1.5 font-medium text-ink-secondary transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
        Incidents
      </Link>

      <PageHeader
        eyebrow={
          <span className="type-numeric">Incident {incident.reference}</span>
        }
        title={incident.title}
        action={
          <StatusBadge
            presentation={INCIDENT_STATUS_PRESENTATION[currentStatus]}
            size="md"
          />
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          {/* Summary */}
          <Card radius="xl">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                presentation={INCIDENT_SEVERITY_PRESENTATION[incident.severity]}
              />
              <StatusChip tone="neutral">
                {INCIDENT_CATEGORY_LABEL[incident.category]}
              </StatusChip>
              {incident.rideReference ? (
                <StatusChip tone="info" icon={RouteIcon}>
                  Ride {incident.rideReference}
                </StatusChip>
              ) : null}
            </div>

            <p className="type-body mt-4 text-ink-secondary">
              {incident.description}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <NestedTile>
                <DataPoint
                  label="Opened"
                  value={formatRelativeTime(incident.openedAt)}
                  hint={formatDateTime(incident.openedAt)}
                />
              </NestedTile>
              <NestedTile>
                <DataPoint
                  label="Assigned to"
                  value={incident.assignedTo ?? "Unassigned"}
                />
              </NestedTile>
            </div>
          </Card>

          {/* People */}
          <Card radius="xl">
            <CardHeader
              title="People involved"
              description="Contact details are visible while this incident is open."
            />

            <ul className="mt-5 space-y-2.5">
              {incident.participants.map((person) => (
                <li key={person.id}>
                  <NestedTile className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={person.name} size="sm" />
                      <div className="min-w-0">
                        <p className="type-body truncate font-medium text-ink">
                          {person.name}
                        </p>
                        <p className="type-meta text-ink-muted">
                          {person.role === UserRole.DRIVER
                            ? "Driver"
                            : person.role === UserRole.PASSENGER
                              ? "Passenger"
                              : "Oversight"}
                          {!resolved && (phones[person.id] ?? person.phone) ? (
                            <span className="type-numeric"> · {phones[person.id] ?? person.phone}</span>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 sm:shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Phone}
                        disabled={resolved || saving}
                        onClick={() => call(person)}
                      >
                        Call
                      </Button>
                      {person.role !== UserRole.ADMIN && person.id ? (
                        <ButtonLink
                          variant="ghost"
                          size="sm"
                          icon={UserRound}
                          href={person.role === UserRole.DRIVER ? `/admin/drivers/${person.id}` : `/admin/passengers/${person.id}`}
                        >
                          Record
                        </ButtonLink>
                      ) : null}
                    </div>
                  </NestedTile>
                </li>
              ))}
            </ul>
          </Card>

          {/* Timeline */}
          <Card radius="xl">
            <CardHeader title="What happened" />
            <Timeline items={timeline} className="mt-6" />
          </Card>

          {/* Notes */}
          <Card radius="xl">
            <CardHeader
              title="Notes"
              description="A record of what the oversight team did and when."
            />

            <div className="mt-5 space-y-2.5">
              {notes.length === 0 ? (
                <p className="type-meta text-ink-muted">
                  No notes yet. Add the first one below.
                </p>
              ) : (
                notes.map((note) => (
                  <NestedTile key={note.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="type-meta font-medium text-ink">
                        {note.author}
                      </p>
                      <p className="type-meta text-ink-muted">
                        {formatRelativeTime(note.at)}
                      </p>
                    </div>
                    <p className="type-meta mt-1.5 text-ink-secondary">
                      {note.note}
                    </p>
                  </NestedTile>
                ))
              )}
            </div>

            <div className="mt-5 space-y-3">
              <Textarea
                label="Add a note"
                placeholder="What did you do, and what happens next?"
                rows={3}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button
                variant="secondary"
                size="lg"
                icon={MessageSquare}
                className="w-full sm:w-auto"
                disabled={!draft.trim() || saving}
                onClick={addNote}
              >
                Add note
              </Button>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="min-w-0">
          <Card radius="xl" className="lg:sticky lg:top-20">
            <CardHeader
              title="Response"
              description={
                resolved
                  ? "This incident is closed."
                  : "Move the incident along as the team works it."
              }
            />

            {resolved ? (
              <NestedTile className="mt-5 flex items-start gap-3">
                <CheckCircle2
                  className="mt-0.5 size-4.5 shrink-0 text-success-600 dark:text-success-400"
                  strokeWidth={1.9}
                  aria-hidden
                />
                <p className="type-meta text-ink-secondary">
                  Resolved{" "}
                  {incident.resolvedAt
                    ? formatRelativeTime(incident.resolvedAt)
                    : "just now"}
                  . Reopen it if anything changes.
                </p>
              </NestedTile>
            ) : null}
            {resolved ? (
              <Button
                variant="secondary"
                size="lg"
                className="mt-3 w-full"
                loading={saving}
                onClick={() => moveTo(IncidentStatus.OPEN, "Incident reopened")}
              >
                Reopen incident
              </Button>
            ) : (
              <div className="mt-5 space-y-2.5">
                {currentStatus === IncidentStatus.OPEN ? (
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    loading={saving}
                    onClick={() => moveTo(IncidentStatus.UNDER_REVIEW, "Incident moved to review", "The safety desk has picked this up.")}
                  >
                    Start review
                  </Button>
                ) : null}

                <Button
                  variant={
                    currentStatus === IncidentStatus.OPEN
                      ? "secondary"
                      : "primary"
                  }
                  size="lg"
                  icon={CheckCircle2}
                  className="w-full"
                  onClick={() => setResolving(true)}
                >
                  Mark resolved
                </Button>
              </div>
            )}

            <div className="kx-hairline my-5" role="presentation" />

            <p className="type-meta text-ink-muted">
              Incident records are kept for the safety of the community. They
              are not shared with other members.
            </p>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={resolving}
        onClose={() => setResolving(false)}
        onConfirm={() => {
          setResolving(false);
          moveTo(IncidentStatus.RESOLVED, "Incident resolved", "Everyone involved has been told it is closed.");
        }}
        title="Mark this incident resolved?"
        description="Close it only once the people involved have been contacted and the outcome is recorded in the notes."
        confirmLabel="Mark resolved"
      />
    </div>
  );
}
