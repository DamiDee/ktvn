"use client";

import { useQuery } from "@tanstack/react-query";
import { Car, Info, Palette, ScanLine, Users, Wrench } from "lucide-react";
import { Card, CardHeader, NestedTile } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge, VerifiedBadge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/route-loader";
import { SafetyNote } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/app-shell";
import { DriverCard } from "@/components/drivers/driver-card";
import { queryKeys } from "@/constants/query-keys";
import { useCurrentDriver } from "./use-current-driver";
import { verificationService } from "@/services";
import { DOCUMENT_STATUS_PRESENTATION } from "@/constants/status-presentation";
import { DocumentType } from "@/types/enums";
import { formatDate } from "@/lib/format";

const VEHICLE_DOCUMENT_TYPES: DocumentType[] = [
  DocumentType.VEHICLE_REGISTRATION,
  DocumentType.INSURANCE,
  DocumentType.ROADWORTHINESS,
];

/**
 * The driver's vehicle as passengers see it, plus the paperwork behind it.
 */
export function DriverVehicle() {
  const { data: driver, isLoading } = useCurrentDriver();

  const { data: verification } = useQuery({
    queryKey: queryKeys.driver.verification(),
    queryFn: () => verificationService.getMyVerification(),
  });

  if (isLoading || !driver) return <PageLoader message="Loading your vehicle" />;

  const vehicle = driver.vehicle;
  const vehicleDocuments =
    verification?.documents.filter((doc) =>
      VEHICLE_DOCUMENT_TYPES.includes(doc.type),
    ) ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Your vehicle"
        title={`${vehicle.make} ${vehicle.model}`}
        description="This is what passengers check against before they board."
        action={
          vehicle.verified ? (
            <VerifiedBadge label="Vehicle Verified" size="md" />
          ) : undefined
        }
      />

      <div className="space-y-5">
        {/* Passenger view */}
        <Card radius="xl">
          <CardHeader
            title="How passengers see it"
            description="Photo, name, vehicle, colour and plate are all shown before boarding."
          />
          <div className="mt-5">
            <DriverCard driver={driver} showContact={false} />
          </div>
        </Card>

        {/* Details */}
        <Card radius="xl">
          <CardHeader title="Vehicle details" />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <DetailTile icon={Car} label="Make and model">
              {vehicle.make} {vehicle.model}
              {vehicle.year ? ` (${vehicle.year})` : ""}
            </DetailTile>
            <DetailTile icon={Palette} label="Colour">
              {vehicle.colour}
            </DetailTile>
            <DetailTile icon={ScanLine} label="Plate number" numeric>
              {vehicle.plateNumber}
            </DetailTile>
            <DetailTile icon={Users} label="Passenger seats">
              {vehicle.seats}
            </DetailTile>
          </div>

          <SafetyNote className="mt-5">
            If any of these change — a repaint, a new plate, a different car —
            update them here. Passengers rely on this to identify the vehicle,
            and a mismatch is a safety issue.
          </SafetyNote>
        </Card>

        {/* Documents */}
        <Card radius="xl">
          <CardHeader
            title="Vehicle documents"
            description="Required on both tracks, without exception."
            action={
              <ButtonLink href="/driver/verification" variant="ghost" size="sm">
                Manage
              </ButtonLink>
            }
          />

          <ul className="mt-5 divide-y divide-line">
            {vehicleDocuments.length === 0 ? (
              <li className="type-meta py-3 text-ink-muted">
                No vehicle documents on file yet.
              </li>
            ) : (
              vehicleDocuments.map((doc) => (
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
                      {doc.expiresAt
                        ? ` · expires ${formatDate(doc.expiresAt)}`
                        : ""}
                    </p>
                  </div>
                  <StatusBadge
                    presentation={DOCUMENT_STATUS_PRESENTATION[doc.status]}
                  />
                </li>
              ))
            )}
          </ul>
        </Card>

        {/* Inspection */}
        <Card radius="xl">
          <div className="flex items-start gap-3.5">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-nested text-ink-secondary">
              <Wrench className="size-5" strokeWidth={1.7} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="type-card-title text-ink">Physical inspection</p>
              <p className="type-meta mt-1 text-ink-secondary">
                {verification?.inspection.scheduled &&
                verification.inspection.scheduledAt
                  ? `Scheduled for ${formatDate(verification.inspection.scheduledAt)} at ${verification.inspection.location ?? "a location to be confirmed"}.`
                  : (verification?.inspection.note ??
                    "The verification team will contact you with inspection details.")}
              </p>
            </div>
          </div>
        </Card>

        <div className="flex items-start gap-3 rounded-[var(--kx-radius-md)] border border-line bg-surface-nested p-4">
          <Info
            className="mt-0.5 size-4 shrink-0 text-ink-muted"
            strokeWidth={1.8}
            aria-hidden
          />
          <p className="type-meta text-ink-secondary">
            Insurance shown here is your own policy. The network doesn&rsquo;t
            provide insurance for rides.
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailTile({
  icon: Icon,
  label,
  children,
  numeric = false,
}: {
  icon: typeof Car;
  label: string;
  children: React.ReactNode;
  numeric?: boolean;
}) {
  return (
    <NestedTile>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-ink-muted" strokeWidth={1.7} aria-hidden />
        <p className="type-micro text-ink-muted">{label}</p>
      </div>
      <p
        className={`type-body mt-1.5 font-semibold text-ink ${numeric ? "type-numeric" : ""}`}
      >
        {children}
      </p>
    </NestedTile>
  );
}
