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
  Check,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileText,
  Flag,
  IdCard,
  Lock,
  MapPin,
  MessageSquare,
  Send,
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
import { Textarea, Checkbox, Select } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
import {
  formatDate,
  formatDateTime,
  formatPlate,
  formatRelativeTime,
} from "@/lib/format";
import type { ReviewComment, VerificationDocument } from "@/types/models";

type Tab =
  | "identity"
  | "licence"
  | "vehicle"
  | "documents"
  | "inspection"
  | "comments"
  | "history";

type Decision = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

/** Documents that are blocking — the reviewer can't approve past these. */
function blockingDocuments(documents: VerificationDocument[]) {
  return documents.filter(
    (document) =>
      document.status === DocumentStatus.MISSING ||
      document.status === DocumentStatus.EXPIRED ||
      document.status === DocumentStatus.NEEDS_ATTENTION,
  );
}

function documentByType(
  documents: VerificationDocument[],
  type: DocumentType,
) {
  return documents.find((document) => document.type === type);
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

  // Reviewer decisions on individual documents and the notes they leave, held
  // here until the backend exists.
  const [documentEdits, setDocumentEdits] = useState<
    Record<string, VerificationDocument>
  >({});
  const [flagging, setFlagging] = useState<VerificationDocument | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [addedComments, setAddedComments] = useState<ReviewComment[]>([]);

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
  const documents = record.documents.map(
    (document) => documentEdits[document.id] ?? document,
  );
  const status = decided ?? record.status;
  const settled =
    status === VerificationStatus.APPROVED ||
    status === VerificationStatus.REJECTED ||
    status === VerificationStatus.CHANGES_REQUIRED;

  const blocking = blockingDocuments(documents);
  const licence = documentByType(documents, DocumentType.DRIVERS_LICENCE);
  const identityDoc = documentByType(documents, DocumentType.GOVERNMENT_ID);
  const photo = documentByType(documents, DocumentType.PROFILE_PHOTO);
  const insurance = documentByType(documents, DocumentType.INSURANCE);
  const verifiedCount = documents.filter(
    (document) => document.status === DocumentStatus.VERIFIED,
  ).length;
  const allVerified = verifiedCount === documents.length;
  const comments = [...(record.comments ?? []), ...addedComments];

  function applyDocument(document: VerificationDocument) {
    setDocumentEdits((current) => ({ ...current, [document.id]: document }));
    // The preview, if open on this document, follows the decision.
    setPreview((current) =>
      current && current.id === document.id ? document : current,
    );
  }

  async function verifyDocument(document: VerificationDocument) {
    const updated = await verificationService.setDocumentStatus(
      id,
      document.id,
      DocumentStatus.VERIFIED,
    );
    applyDocument({ ...updated, note: undefined });
    toast({ title: `${document.label} verified`, tone: "success" });
  }

  async function flagDocument(document: VerificationDocument, reason: string) {
    const updated = await verificationService.setDocumentStatus(
      id,
      document.id,
      DocumentStatus.NEEDS_ATTENTION,
      reason,
    );
    applyDocument(updated);
    toast({
      title: `${document.label} flagged`,
      description: "The applicant will see your reason.",
      tone: "warning",
    });
  }

  async function addComment(
    body: string,
    visibility: ReviewComment["visibility"],
    documentId?: string,
  ) {
    const comment = await verificationService.addComment(id, {
      body,
      visibility,
      documentId,
    });
    setAddedComments((current) => [...current, comment]);
    toast({
      title:
        visibility === "APPLICANT" ? "Feedback sent" : "Note added to the file",
      tone: "success",
    });
  }

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
      count: documents.length,
    },
    { value: "inspection" as const, label: "Inspection" },
    { value: "comments" as const, label: "Comments", count: comments.length },
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
    ...blocking.map(
      (document) =>
        document.note ?? `Re-upload ${document.label.toLowerCase()}`,
    ),
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
                      {verifiedCount}/{documents.length} verified
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
                      settled={settled}
                      onView={() => setPreview(licence)}
                      onVerify={() => verifyDocument(licence)}
                      onFlag={() => {
                        setFlagReason(licence.note ?? "");
                        setFlagging(licence);
                      }}
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
                              documents,
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
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <StatusChip tone={allVerified ? "success" : "pending"}>
                    {verifiedCount} of {documents.length} verified
                  </StatusChip>
                  {blocking.length > 0 ? (
                    <StatusChip tone="danger">
                      {blocking.length} flagged
                    </StatusChip>
                  ) : null}
                </div>

                <ul className="space-y-2.5">
                  {documents.map((document) => (
                    <li key={document.id}>
                      <DocumentRow
                        document={document}
                        settled={settled}
                        onView={() => setPreview(document)}
                        onVerify={() => verifyDocument(document)}
                        onFlag={() => {
                          setFlagReason(document.note ?? "");
                          setFlagging(document);
                        }}
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

              <TabPanel active={tab === "comments"}>
                <CommentThread
                  comments={comments}
                  documents={documents}
                  settled={settled}
                  onAdd={addComment}
                />
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
                    disabled={!allVerified || decide.isPending}
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

                {!allVerified ? (
                  <p className="type-meta mt-4 text-ink-muted">
                    {blocking.length > 0
                      ? `Approval is unavailable while ${
                          blocking.length === 1
                            ? "a document is flagged"
                            : `${blocking.length} documents are flagged`
                        }.`
                      : `Verify all ${documents.length} documents before approving — ${verifiedCount} done so far.`}
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
          preview && !settled ? (
            <>
              <Button
                variant="ghost"
                icon={Flag}
                className="text-warn-700 dark:text-warn-300"
                onClick={() => {
                  setFlagReason(preview.note ?? "");
                  setFlagging(preview);
                }}
              >
                Flag
              </Button>
              <Button
                variant="primary"
                icon={Check}
                disabled={preview.status === DocumentStatus.VERIFIED}
                onClick={() => verifyDocument(preview)}
              >
                {preview.status === DocumentStatus.VERIFIED
                  ? "Verified"
                  : "Verify document"}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Close
            </Button>
          )
        }
      >
        <div className="space-y-4">
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[var(--kx-radius-md)] border border-line bg-surface-nested">
            <div className="px-6 text-center">
              <IdCard
                className="mx-auto size-8 text-ink-muted"
                strokeWidth={1.4}
                aria-hidden
              />
              <p className="type-body mt-2.5 font-medium text-ink">
                {preview?.fileName ?? "No file"}
              </p>
              <p className="type-meta mt-1 text-ink-muted">
                {preview?.fileType ?? "File"}
                {preview?.sizeBytes
                  ? ` · ${Math.round(preview.sizeBytes / 1024)} KB`
                  : ""}
              </p>
              <p className="type-meta mt-3 text-ink-muted">
                The uploaded file opens here once storage is connected.
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
                  hint={
                    preview.expiresAt
                      ? `Expires ${formatDate(preview.expiresAt)}`
                      : undefined
                  }
                />
              </NestedTile>
            </div>
          ) : null}

          {preview?.note ? (
            <NestedTile className="border-warn-500/30">
              <p className="type-micro text-ink-muted">Your note</p>
              <p className="type-meta mt-1.5 text-ink-secondary">
                {preview.note}
              </p>
            </NestedTile>
          ) : null}
        </div>
      </Modal>

      {/* Flag a document */}
      <Modal
        open={flagging !== null}
        onClose={() => setFlagging(null)}
        title={`Flag ${flagging?.label.toLowerCase() ?? "this document"}`}
        description="Say what's wrong with it. The applicant sees this word for word, so make it something they can act on."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFlagging(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!flagReason.trim()}
              onClick={async () => {
                if (!flagging) return;
                const document = flagging;
                const reason = flagReason.trim();
                setFlagging(null);
                setFlagReason("");
                await flagDocument(document, reason);
              }}
            >
              Flag document
            </Button>
          </>
        }
      >
        <Textarea
          label="What needs fixing"
          placeholder="e.g. The certificate is too blurred to read the expiry date."
          rows={3}
          required
          value={flagReason}
          onChange={(event) => setFlagReason(event.target.value)}
        />
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
              disabled={checked.length === 0 || !note.trim()}
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
            label="Note to the applicant"
            placeholder="Anything else they should know before resubmitting"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            required
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
  settled,
  onView,
  onVerify,
  onFlag,
}: {
  document: VerificationDocument;
  settled: boolean;
  onView: () => void;
  onVerify: () => void;
  onFlag: () => void;
}) {
  const presentation = DOCUMENT_STATUS_PRESENTATION[document.status];
  const uploaded = Boolean(document.fileName);
  const verified = document.status === DocumentStatus.VERIFIED;

  return (
    <NestedTile
      className={cn(
        verified && "border-success-500/30",
        document.status === DocumentStatus.NEEDS_ATTENTION &&
          "border-warn-500/35",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-full ring-1",
            verified
              ? "bg-success-50 text-success-700 ring-success-500/25 dark:bg-success-500/12 dark:text-success-300"
              : "bg-surface text-ink-secondary ring-line",
          )}
        >
          {verified ? (
            <BadgeCheck className="size-4.5" strokeWidth={1.9} aria-hidden />
          ) : (
            <FileText className="size-4.5" strokeWidth={1.7} aria-hidden />
          )}
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

        <StatusChip tone={presentation.tone} className="sm:shrink-0">
          {presentation.label}
        </StatusChip>
      </div>

      {/* The reviewer's judgement on this one document */}
      {uploaded && !settled ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
          <Button
            variant="secondary"
            size="sm"
            icon={Eye}
            className="col-span-2 sm:flex-1"
            onClick={onView}
          >
            View document
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Check}
            className="min-w-0 sm:flex-1"
            disabled={verified}
            onClick={onVerify}
          >
            {verified ? "Verified" : "Verify"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Flag}
            className="min-w-0 text-warn-700 sm:flex-1 dark:text-warn-300"
            onClick={onFlag}
          >
            Flag
          </Button>
        </div>
      ) : uploaded ? (
        <Button
          variant="secondary"
          size="sm"
          icon={Eye}
          className="mt-3 w-full sm:w-auto"
          onClick={onView}
        >
          View document
        </Button>
      ) : null}
    </NestedTile>
  );
}

/**
 * The review thread.
 *
 * Internal notes and applicant feedback share one timeline so the reviewer can
 * see what the driver has actually been told, but each entry says plainly
 * which it is.
 */
function CommentThread({
  comments,
  documents,
  settled,
  onAdd,
}: {
  comments: ReviewComment[];
  documents: VerificationDocument[];
  settled: boolean;
  onAdd: (
    body: string,
    visibility: ReviewComment["visibility"],
    documentId?: string,
  ) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [visibility, setVisibility] =
    useState<ReviewComment["visibility"]>("INTERNAL");
  const [documentId, setDocumentId] = useState("");
  const [sending, setSending] = useState(false);

  const ordered = [...comments].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  async function send() {
    const text = body.trim();
    if (!text) return;

    setSending(true);
    try {
      await onAdd(text, visibility, documentId || undefined);
      setBody("");
      setDocumentId("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {ordered.length === 0 ? (
        <NestedTile>
          <p className="type-meta text-ink-secondary">
            No notes on this application yet. Anything you write here stays with
            the file.
          </p>
        </NestedTile>
      ) : (
        <ul className="space-y-2.5">
          {ordered.map((comment) => {
            const about = documents.find(
              (document) => document.id === comment.documentId,
            );
            const toApplicant = comment.visibility === "APPLICANT";

            return (
              <li key={comment.id}>
                <NestedTile
                  className={cn(
                    toApplicant && "border-forest-500/25 dark:border-gold-500/25",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="type-meta font-medium text-ink">
                      {comment.author}
                    </p>
                    <div className="flex items-center gap-2">
                      <StatusChip
                        tone={toApplicant ? "info" : "neutral"}
                        icon={toApplicant ? Send : Lock}
                      >
                        {toApplicant ? "Sent to applicant" : "Internal note"}
                      </StatusChip>
                      <span className="type-meta text-ink-muted">
                        {formatRelativeTime(comment.at)}
                      </span>
                    </div>
                  </div>

                  {about ? (
                    <p className="type-micro mt-2 text-ink-muted">
                      About {about.label}
                    </p>
                  ) : null}

                  <p className="type-meta mt-1.5 text-ink-secondary">
                    {comment.body}
                  </p>
                </NestedTile>
              </li>
            );
          })}
        </ul>
      )}

      {settled ? (
        <p className="type-meta mt-5 text-ink-muted">
          This application has been decided. The thread is kept as a record.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          <SegmentedControl
            label="Who sees this note"
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: "INTERNAL" as const, label: "Internal note", icon: Lock },
              {
                value: "APPLICANT" as const,
                label: "Send to applicant",
                icon: Send,
              },
            ]}
          />

          <Select
            label="About a document (optional for internal notes)"
            placeholder="The application as a whole"
            value={documentId}
            onChange={(event) => setDocumentId(event.target.value)}
            options={documents.map((document) => ({
              value: document.id,
              label: document.label,
            }))}
          />

          <Textarea
            label={
              visibility === "APPLICANT"
                ? "Feedback for the applicant"
                : "Note for the team"
            }
            placeholder={
              visibility === "APPLICANT"
                ? "Tell them exactly what you need and why"
                : "What you checked, and what you concluded"
            }
            rows={3}
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />

          <Button
            variant="primary"
            size="lg"
            icon={visibility === "APPLICANT" ? Send : MessageSquare}
            className="w-full sm:w-auto"
            loading={sending}
            loadingLabel="Saving"
            disabled={!body.trim()}
            onClick={send}
          >
            {visibility === "APPLICANT" ? "Send feedback" : "Add note"}
          </Button>
        </div>
      )}
    </div>
  );
}
