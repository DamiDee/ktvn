"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Car,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  IdCard,
  MapPin,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardHeader, DataPoint, NestedTile } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, StatusChip } from "@/components/ui/badge";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Textarea, Checkbox } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { PageLoader } from "@/components/ui/route-loader";
import { PageHeader } from "@/components/layout/app-shell";
import { queryKeys } from "@/constants/query-keys";
import { verificationService } from "@/services";
import {
  DOCUMENT_STATUS_PRESENTATION,
  TRACK_DESCRIPTION,
  TRACK_LABEL,
  TRACK_TONE,
  VERIFICATION_PRESENTATION,
} from "@/constants/status-presentation";
import { DocumentStatus, DocumentType, VerificationStatus } from "@/types/enums";
import { formatDate, formatDateTime, formatPlate } from "@/lib/format";
import type { DriverVerification, VerificationDocument } from "@/types/models";

type Tab =
  | "identity"
  | "licence"
  | "vehicle"
  | "documents"
  | "inspection"
  | "history";

type Decision = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

/** Documents that are blocking — the reviewer can't approve past these. */
function blockingDocuments(record: DriverVerification) {
  return record.documents.filter(
    (document) =>
      document.status === DocumentStatus.MISSING ||
      document.status === DocumentStatus.EXPIRED ||
      document.status === DocumentStatus.NEEDS_ATTENTION,
  );
}

function documentByType(record: DriverVerification, type: DocumentType) {
  return record.documents.find((document) => document.type === type);
}

function expiryTone(document?: VerificationDocument) {
  if (!document?.expiresAt) return null;
  const days = Math.round(
    (new Date(document.expiresAt).getTime() - Date.now()) / 86_400_000,
  );
  if (days < 0) return { tone: "danger" as const, label: "Expired" };
  if (days < 90)
    return { tone: "pending" as const, label: `Expires in ${days} days` };
  return { tone: "success" as const, label: "Valid" };
}

/**
 * A single application, reviewed.
 *
 * Both tracks are held to exactly the same standard — Product Rule 10 — so
 * this screen never changes its checks based on the applicant's track. The
 * only thing the track changes is the wording of what approval unlocks.
 */
export function VerificationReview({ id }: { id: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("identity");
  const [preview, setPreview] = useState<VerificationDocument | null>(null);
  const [confirming, setConfirming] = useState<Decision | null>(null);
  const [changesOpen, setChangesOpen] = useState(false);
  const [note, setNote] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [decided, setDecided] = useState<VerificationStatus | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.verification(id),
    queryFn: () => verificationService.getVerification(id),
  });

  const decide = useMutation({
    mutationFn: (decision: Decision) => verificationService.decide(id, decision),
    onSuccess: (status, decision) => {
      setDecided(status);
      setConfirming(null);
      setChangesOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.verifications() });
      toast({
        title:
          decision === "APPROVE"
            ? "Application approved"
            : decision === "REJECT"
              ? "Application rejected"
              : "Changes requested",
        description:
          decision === "REQUEST_CHANGES"
            ? "The applicant has been told exactly what to fix."
            : undefined,
        tone: decision === "REJECT" ? "danger" : "success",
      });
    },
    onError: () => {
      toast({
        title: "That decision didn't save.",
        description: "Nothing has changed. Try again in a moment.",
        tone: "danger",
      });
    },
  });

  if (isLoading) return <PageLoader message="Loading the application" />;

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorState
          title="We couldn't find that application."
          description="It may have been decided already, or the link may be out of date."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const record = data;
  const status = decided ?? record.status;
  const settled =
    status === VerificationStatus.APPROVED ||
    status === VerificationStatus.REJECTED ||
    status === VerificationStatus.CHANGES_REQUIRED;

  const blocking = blockingDocuments(record);
  const licence = documentByType(record, DocumentType.DRIVERS_LICENCE);
  const identityDoc = documentByType(record, DocumentType.GOVERNMENT_ID);
  const photo = documentByType(record, DocumentType.PROFILE_PHOTO);
  const insurance = documentByType(record, DocumentType.INSURANCE);
  const verifiedCount = record.documents.filter(
    (document) => document.status === DocumentStatus.VERIFIED,
  ).length;

  const timeline: TimelineItem[] = record.steps.map((step) => ({
    id: step.id,
    label: step.label,
    description: step.description,
    meta: step.completedAt ? formatDate(step.completedAt) : undefined,
    state: step.status,
  }));

  const tabs = [
    { value: "identity" as const, label: "Identity" },
    { value: "licence" as const, label: "Licence" },
    { value: "vehicle" as const, label: "Vehicle" },
    {
      value: "documents" as const,
      label: "Documents",
      count: record.documents.length,
    },
    { value: "inspection" as const, label: "Inspection" },
    { value: "history" as const, label: "History" },
  ];

  function toggleChange(value: string) {
    setChecked((current) =>
      current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value],
    );
  }

  const changeItems = [
    ...blocking.map((document) => `Re-upload ${document.label.toLowerCase()}`),
    ...(record.changesRequested ?? []),
    "Provide a clearer photograph of the vehicle",
  ].filter((item, index, list) => list.indexOf(item) === index);

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/admin/verifications"
        className="kx-tap type-meta mb-4 inline-flex items-center gap-1.5 font-medium text-ink-secondary transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
        Verification queue
      </Link>

      <PageHeader
        eyebrow={<span className="type-numeric">Application {record.id}</span>}
        title={record.applicantName}
        action={
          <StatusBadge
            presentation={VERIFICATION_PRESENTATION[status]}
            size="md"
          />
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        {/* Review */}
        <div className="min-w-0 space-y-5">
          {/* Applicant summary */}
          <Card radius="xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3.5">
                <Avatar
                  name={record.applicantName}
                  src={record.applicantAvatarUrl}
                  size="lg"
                />
                <div className="min-w-0">
                  <p className="type-card-title truncate text-ink">
                    {record.applicantName}
                  </p>
                  <p className="type-meta type-numeric mt-0.5 text-ink-muted">
                    {record.driverId}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusChip tone={TRACK_TONE[record.track]}>
                      {TRACK_LABEL[record.track]}
                    </StatusChip>
                    <StatusChip tone={blocking.length ? "pending" : "success"}>
                      {verifiedCount}/{record.documents.length} verified
                    </StatusChip>
                  </div>
                </div>
              </div>
            </div>

            <p className="type-meta mt-4 text-ink-secondary">
              {record.statusDetail}
            </p>

            {blocking.length > 0 ? (
              <NestedTile className="mt-4 flex items-start gap-3 border-warn-500/25">
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-warn-600 dark:text-warn-400"
                  strokeWidth={1.9}
                  aria-hidden
                />
                <p className="type-meta text-ink-secondary">
                  {blocking.length === 1
                    ? "One document still needs attention"
                    : `${blocking.length} documents still need attention`}{" "}
                  before this application can be approved.
                </p>
              </NestedTile>
            ) : null}
          </Card>

          {/* Detail tabs */}
          <Card radius="xl">
            <Tabs
              items={tabs}
              value={tab}
              onChange={setTab}
              label="Application detail"
              className="-mx-5 px-5 sm:-mx-6 sm:px-6"
            />

            <div className="mt-5">
              <TabPanel active={tab === "identity"}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <NestedTile>
                    <DataPoint
                      label="Full name"
                      value={record.applicantName}
                      hint="As it appears on the government ID"
                    />
                  </NestedTile>
                  <NestedTile>
                    <DataPoint
                      label="Member record"
                      value={record.driverId}
                      hint="Linked to a confirmed church membership"
                    />
                  </NestedTile>
                  <NestedTile>
                    <DataPoint
                      label="Government ID"
                      value={identityDoc?.fileName ?? "Not uploaded"}
                      hint={
                        DOCUMENT_STATUS_PRESENTATION[
                          identityDoc?.status ?? DocumentStatus.MISSING
                        ].label
                      }
                    />
                  </NestedTile>
                  <NestedTile>
                    <DataPoint
                      label="Profile photo"
                      value={photo?.fileName ?? "Not uploaded"}
                      hint={
                        DOCUMENT_STATUS_PRESENTATION[
                          photo?.status ?? DocumentStatus.MISSING
                        ].label
                      }
                    />
                  </NestedTile>
                  <NestedTile>
                    <DataPoint
                      label="Applied"
                      value={
                        record.submittedAt
                          ? formatDate(record.submittedAt)
                          : "Not submitted"
                      }
                    />
                  </NestedTile>
                  <NestedTile>
                    <DataPoint
                      label="Last updated"
                      value={formatDate(record.updatedAt)}
                      hint={formatDateTime(record.updatedAt)}
                    />
                  </NestedTile>
                </div>

                <NestedTile className="mt-3 flex items-start gap-3">
                  <ShieldCheck
                    className="mt-0.5 size-4 shrink-0 text-ink-muted"
                    strokeWidth={1.8}
                    aria-hidden
                  />
                  <p className="type-meta text-ink-secondary">
                    Check that the name on the ID matches the name on the
                    licence and the membership record. Any mismatch is a request
                    for changes, not a rejection.
                  </p>
                </NestedTile>
              </TabPanel>

              <TabPanel active={tab === "licence"}>
                {licence ? (
                  <div className="space-y-3">
                    <DocumentRow
                      document={licence}
                      onView={() => setPreview(licence)}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <NestedTile>
                        <DataPoint
                          label="Expires"
                          value={
                            licence.expiresAt
                              ? formatDate(licence.expiresAt)
                              : "Not stated"
                          }
                        />
                        {expiryTone(licence) ? (
                          <StatusChip
                            tone={expiryTone(licence)!.tone}
                            className="mt-2"
                          >
                            {expiryTone(licence)!.label}
                          </StatusChip>
                        ) : null}
                      </NestedTile>
                      <NestedTile>
                        <DataPoint
                          label="Requirement"
                          value="Valid 3+ months"
                          hint="The same rule applies on both tracks"
                        />
                      </NestedTile>
                    </div>
                  </div>
                ) : (
                  <NestedTile className="flex items-start gap-3">
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-warn-600 dark:text-warn-400"
                      strokeWidth={1.9}
                      aria-hidden
                    />
                    <p className="type-meta text-ink-secondary">
                      No driver&rsquo;s licence has been uploaded. Request
                      changes rather than deciding on the rest.
                    </p>
                  </NestedTile>
                )}
              </TabPanel>

              <TabPanel active={tab === "vehicle"}>
                {record.vehicle ? (
                  <div className="space-y-3">
                    <NestedTile className="flex items-center gap-3.5">
                      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink-secondary ring-1 ring-line">
                        <Car className="size-5" strokeWidth={1.7} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="type-card-title truncate text-ink">
                          {record.vehicle.colour} {record.vehicle.make}{" "}
                          {record.vehicle.model}
                        </p>
                        <p className="type-meta type-numeric mt-0.5 text-ink-muted">
                          {formatPlate(record.vehicle.plateNumber)}
                        </p>
                      </div>
                    </NestedTile>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <NestedTile>
                        <DataPoint
                          label="Year"
                          value={record.vehicle.year ?? "Not stated"}
                        />
                      </NestedTile>
                      <NestedTile>
                        <DataPoint
                          label="Seats"
                          value={record.vehicle.seats}
                          hint="A maximum of three passengers share any ride"
                        />
                      </NestedTile>
                      <NestedTile>
                        <DataPoint
                          label="Registration"
                          value={
                            documentByType(
                              record,
                              DocumentType.VEHICLE_REGISTRATION,
                            )?.fileName ?? "Not uploaded"
                          }
                        />
                      </NestedTile>
                      <NestedTile>
                        <DataPoint
                          label="Insurance"
                          value={insurance?.fileName ?? "Not uploaded"}
                          hint={
                            insurance?.expiresAt
                              ? `Expires ${formatDate(insurance.expiresAt)}`
                              : undefined
                          }
                        />
                      </NestedTile>
                    </div>

                    <p className="type-meta text-ink-muted">
                      The driver&rsquo;s own insurance is checked here. The
                      network doesn&rsquo;t provide insurance for rides.
                    </p>
                  </div>
                ) : (
                  <NestedTile>
                    <p className="type-meta text-ink-secondary">
                      No vehicle has been submitted with this application.
                    </p>
                  </NestedTile>
                )}
              </TabPanel>

              <TabPanel active={tab === "documents"}>
                <ul className="space-y-2.5">
                  {record.documents.map((document) => (
                    <li key={document.id}>
                      <DocumentRow
                        document={document}
                        onView={() => setPreview(document)}
                      />
                    </li>
                  ))}
                </ul>
                <p className="type-meta mt-4 text-ink-muted">
                  Volunteer and professional applicants submit the same six
                  documents. Nothing here is waived for either track.
                </p>
              </TabPanel>

              <TabPanel active={tab === "inspection"}>
                <div className="space-y-3">
                  <NestedTile className="flex items-start gap-3">
                    <span
                      className={cn(
                        "inline-flex size-10 shrink-0 items-center justify-center rounded-full",
                        record.inspection.scheduled
                          ? "bg-forest-100 text-forest-800 dark:bg-gold-500/18 dark:text-gold-200"
                          : "bg-surface text-ink-secondary ring-1 ring-line",
                      )}
                    >
                      <ClipboardCheck
                        className="size-4.5"
                        strokeWidth={1.8}
                        aria-hidden
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="type-body font-medium text-ink">
                        {!record.inspection.required
                          ? "No inspection required"
                          : record.inspection.scheduled
                            ? "Inspection scheduled"
                            : "Inspection not yet scheduled"}
                      </p>
                      <p className="type-meta mt-1 text-ink-secondary">
                        {record.inspection.note ??
                          "A physical check of the vehicle before the driver carries members."}
                      </p>
                    </div>
                  </NestedTile>

                  {record.inspection.scheduled ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <NestedTile>
                        <div className="flex items-center gap-2">
                          <Calendar
                            className="size-4 text-ink-muted"
                            strokeWidth={1.7}
                            aria-hidden
                          />
                          <p className="type-micro text-ink-muted">When</p>
                        </div>
                        <p className="type-body mt-1.5 font-medium text-ink">
                          {record.inspection.scheduledAt
                            ? formatDateTime(record.inspection.scheduledAt)
                            : "To be confirmed"}
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
                          {record.inspection.location ?? "To be confirmed"}
                        </p>
                      </NestedTile>
                    </div>
                  ) : record.inspection.required ? (
                    <Button
                      variant="secondary"
                      size="lg"
                      icon={Calendar}
                      className="w-full sm:w-auto"
                      onClick={() =>
                        toast({
                          title: "Inspection slot requested",
                          description:
                            "The applicant will be offered the next three available times.",
                        })
                      }
                    >
                      Schedule inspection
                    </Button>
                  ) : null}
                </div>
              </TabPanel>

              <TabPanel active={tab === "history"}>
                <Timeline items={timeline} />
                {record.reviewerNote ? (
                  <NestedTile className="mt-5">
                    <p className="type-micro text-ink-muted">Reviewer note</p>
                    <p className="type-meta mt-1.5 text-ink-secondary">
                      {record.reviewerNote}
                    </p>
                  </NestedTile>
                ) : null}
              </TabPanel>
            </div>
          </Card>
        </div>

        {/* Decision — beside the review on desktop, below it on a phone */}
        <div className="min-w-0">
          <Card radius="xl" className="lg:sticky lg:top-20">
            <CardHeader
              title="Decision"
              description={
                settled
                  ? VERIFICATION_PRESENTATION[status].detail
                  : "Both tracks are held to the same standard."
              }
            />

            {settled ? (
              <NestedTile className="mt-5 flex items-start gap-3">
                {status === VerificationStatus.APPROVED ? (
                  <CheckCircle2
                    className="mt-0.5 size-4.5 shrink-0 text-success-600 dark:text-success-400"
                    strokeWidth={1.9}
                    aria-hidden
                  />
                ) : status === VerificationStatus.REJECTED ? (
                  <XCircle
                    className="mt-0.5 size-4.5 shrink-0 text-danger-600 dark:text-red-300"
                    strokeWidth={1.9}
                    aria-hidden
                  />
                ) : (
                  <AlertTriangle
                    className="mt-0.5 size-4.5 shrink-0 text-warn-600 dark:text-warn-400"
                    strokeWidth={1.9}
                    aria-hidden
                  />
                )}
                <div className="min-w-0">
                  <p className="type-body font-medium text-ink">
                    {VERIFICATION_PRESENTATION[status].label}
                  </p>
                  <p className="type-meta mt-1 text-ink-secondary">
                    {status === VerificationStatus.APPROVED
                      ? TRACK_DESCRIPTION[record.track]
                      : "The applicant has been notified."}
                  </p>
                </div>
              </NestedTile>
            ) : (
              <>
                <div className="mt-5 space-y-2.5">
                  <Button
                    variant="primary"
                    size="lg"
                    icon={BadgeCheck}
                    className="w-full"
                    disabled={blocking.length > 0 || decide.isPending}
                    onClick={() => setConfirming("APPROVE")}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    icon={FileText}
                    className="w-full"
                    disabled={decide.isPending}
                    onClick={() => setChangesOpen(true)}
                  >
                    Request changes
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    icon={XCircle}
                    className="w-full text-danger-600 dark:text-red-300"
                    disabled={decide.isPending}
                    onClick={() => setConfirming("REJECT")}
                  >
                    Reject
                  </Button>
                </div>

                {blocking.length > 0 ? (
                  <p className="type-meta mt-4 text-ink-muted">
                    Approval is unavailable while{" "}
                    {blocking.length === 1
                      ? "a document needs"
                      : `${blocking.length} documents need`}{" "}
                    attention.
                  </p>
                ) : null}
              </>
            )}

            <div className="kx-hairline my-5" role="presentation" />

            <p className="type-meta text-ink-muted">
              Approving confirms the checks were completed. It doesn&rsquo;t
              guarantee a safe journey, and the network doesn&rsquo;t provide
              insurance for rides.
            </p>
          </Card>
        </div>
      </div>

      {/* Document preview */}
      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.label ?? "Document"}
        description={preview?.fileName ?? "No file uploaded"}
        footer={
          <Button variant="secondary" onClick={() => setPreview(null)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[var(--kx-radius-md)] border border-line bg-surface-nested">
            <div className="text-center">
              <IdCard
                className="mx-auto size-8 text-ink-muted"
                strokeWidth={1.4}
                aria-hidden
              />
              <p className="type-meta mt-2 text-ink-muted">
                {preview?.fileType ?? "File"} preview
              </p>
            </div>
          </div>

          {preview ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <NestedTile>
                <DataPoint
                  label="Status"
                  value={DOCUMENT_STATUS_PRESENTATION[preview.status].label}
                />
              </NestedTile>
              <NestedTile>
                <DataPoint
                  label="Uploaded"
                  value={
                    preview.uploadedAt
                      ? formatDate(preview.uploadedAt)
                      : "Not uploaded"
                  }
                />
              </NestedTile>
            </div>
          ) : null}

          {preview?.note ? (
            <p className="type-meta text-ink-secondary">{preview.note}</p>
          ) : null}
        </div>
      </Modal>

      {/* Request changes */}
      <Modal
        open={changesOpen}
        onClose={() => setChangesOpen(false)}
        title="Request changes"
        description="Say exactly what needs fixing. The applicant keeps everything already accepted."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setChangesOpen(false)}
              disabled={decide.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={decide.isPending}
              loadingLabel="Sending"
              disabled={checked.length === 0 && !note.trim()}
              onClick={() => decide.mutate("REQUEST_CHANGES")}
            >
              Send request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-3">
            {changeItems.map((item) => (
              <Checkbox
                key={item}
                label={item}
                checked={checked.includes(item)}
                onChange={() => toggleChange(item)}
              />
            ))}
          </div>

          <Textarea
            label="Note to the applicant (optional)"
            placeholder="Anything else they should know before resubmitting"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </Modal>

      {/* Approve / reject */}
      <ConfirmDialog
        open={confirming === "APPROVE"}
        onClose={() => setConfirming(null)}
        onConfirm={() => decide.mutate("APPROVE")}
        title="Approve this application?"
        description={`${record.applicantName} will be able to carry members on the ${TRACK_LABEL[record.track].toLowerCase()} track. You can suspend the driver later if something changes.`}
        confirmLabel="Approve"
        loading={decide.isPending}
      />

      <ConfirmDialog
        open={confirming === "REJECT"}
        onClose={() => setConfirming(null)}
        onConfirm={() => decide.mutate("REJECT")}
        title="Reject this application?"
        description="Rejection closes the application. If the applicant could fix the problem, request changes instead."
        confirmLabel="Reject application"
        tone="danger"
        loading={decide.isPending}
      />
    </div>
  );
}

function DocumentRow({
  document,
  onView,
}: {
  document: VerificationDocument;
  onView: () => void;
}) {
  const presentation = DOCUMENT_STATUS_PRESENTATION[document.status];
  const uploaded = Boolean(document.fileName);

  return (
    <NestedTile className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink-secondary ring-1 ring-line">
        <FileText className="size-4.5" strokeWidth={1.7} aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className="type-body truncate font-medium text-ink">
          {document.label}
        </p>
        <p className="type-meta truncate text-ink-muted">
          {uploaded
            ? [
                document.fileName,
                document.uploadedAt ? formatDate(document.uploadedAt) : null,
                document.expiresAt
                  ? `Expires ${formatDate(document.expiresAt)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Nothing uploaded yet"}
        </p>
        {document.note ? (
          <p className="type-meta mt-1 text-warn-700 dark:text-warn-300">
            {document.note}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 sm:shrink-0">
        <StatusChip tone={presentation.tone}>{presentation.label}</StatusChip>
        {uploaded ? (
          <Button variant="ghost" size="sm" onClick={onView}>
            View
          </Button>
        ) : null}
      </div>
    </NestedTile>
  );
}
