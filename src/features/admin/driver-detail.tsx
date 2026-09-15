"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Car,
  CalendarClock,
  ClipboardCheck,
  Clock,
  Flag,
  Route as RouteIcon,
  Star,
  Users,
} from "lucide-react";
import { Card, CardHeader, DataPoint, NestedTile } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, StatusChip, VerifiedBadge } from "@/components/ui/badge";
import { CountUp } from "@/components/ui/stats-card";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Input, Textarea } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { PageLoader } from "@/components/ui/route-loader";
import { PageHeader } from "@/components/layout/app-shell";
import { queryKeys } from "@/constants/query-keys";
import { rideService, userService } from "@/services";
import {
  DRIVER_AVAILABILITY_PRESENTATION,
  RIDE_STATUS_PRESENTATION,
  RIDE_TYPE_LABEL,
  TRACK_DESCRIPTION,
  TRACK_LABEL,
  TRACK_TONE,
  VERIFICATION_PRESENTATION,
} from "@/constants/status-presentation";
import {
  DriverAccountStatus,
  DriverTrack,
  InspectionStatus,
  VerificationStatus,
} from "@/types/enums";
import {
  formatDate,
  formatDateTime,
  formatNaira,
  formatPlate,
  pluralise,
} from "@/lib/format";

/**
 * One driver's record.
 *
 * Money appears here only for a professional driver, and only as a record of
 * what has been earned — Product Rules 1 and 7. A volunteer's contribution is
 * measured in trips, hours and people carried.
 */
export function DriverDetail({ driverId }: { driverId: string }) {
  const { toast } = useToast();
  const [deactivating, setDeactivating] = useState(false);
  const [accountOverride, setAccountOverride] = useState<DriverAccountStatus | null>(null);
  const [flagOverride, setFlagOverride] = useState<boolean | null>(null);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [inspectionDate, setInspectionDate] = useState("");
  const [inspectionLocation, setInspectionLocation] = useState("Koinonia Centre vehicle bay");
  const [inspectionNote, setInspectionNote] = useState("");
  const [savingInspection, setSavingInspection] = useState(false);

  const { data: driver, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.driver(driverId),
    queryFn: () => userService.getDriver(driverId),
  });

  // Narrowed to the driver's own track: a volunteer's record must never show
  // a professional trip's fare (Product Rule 1).
  const { data: trips } = useQuery({
    queryKey: [...queryKeys.admin.driver(driverId), "trips", driver?.track],
    queryFn: () => rideService.listDriverTrips(driver?.track),
    enabled: Boolean(driver),
  });

  if (isLoading) return <PageLoader message="Loading the driver record" />;

  if (isError || !driver) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorState
          title="We couldn't find that driver."
          description="The record may have been removed, or the link may be out of date."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const volunteer = driver.track === DriverTrack.VOLUNTEER;
  const accountStatus = accountOverride ?? driver.accountStatus ?? DriverAccountStatus.ACTIVE;
  const deactivated = accountStatus === DriverAccountStatus.DEACTIVATED;
  const flagged = flagOverride ?? driver.flagged ?? false;
  const approved =
    driver.verificationStatus === VerificationStatus.APPROVED && !deactivated;
  const recentTrips = (trips ?? []).slice(0, 4);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/drivers"
        className="kx-tap type-meta mb-4 inline-flex items-center gap-1.5 font-medium text-ink-secondary transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
        Drivers
      </Link>

      <PageHeader
        eyebrow="Driver record"
        title={driver.fullName}
        action={
          deactivated ? (
            <StatusChip tone="danger" size="md">
              Deactivated
            </StatusChip>
          ) : (
            <StatusBadge
              presentation={
                driver.verificationStatus === VerificationStatus.APPROVED
                  ? DRIVER_AVAILABILITY_PRESENTATION[driver.availability]
                  : VERIFICATION_PRESENTATION[driver.verificationStatus]
              }
              size="md"
            />
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          {/* Identity */}
          <Card radius="xl">
            <div className="flex min-w-0 flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <Avatar
                name={driver.fullName}
                src={driver.avatarUrl}
                size="xl"
                verified={approved}
              />
              <div className="w-full min-w-0 flex-1">
                <h2 className="type-section-title truncate text-ink">
                  {driver.fullName}
                </h2>
                <p className="type-meta mt-1 truncate text-ink-muted">
                  {driver.email} · Joined{" "}
                  {new Date(driver.joinedAt).getFullYear()}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <StatusChip tone={TRACK_TONE[driver.track]}>
                    {TRACK_LABEL[driver.track]}
                  </StatusChip>
                  {approved ? <VerifiedBadge label="Verified driver" /> : null}
                  {flagged ? (
                    <StatusChip tone="pending" icon={Flag}>
                      Flagged for review
                    </StatusChip>
                  ) : null}
                </div>
              </div>
            </div>

            <p className="type-meta mt-4 text-ink-secondary">
              {TRACK_DESCRIPTION[driver.track]}
            </p>
          </Card>

          {/* Service or earnings — never both */}
          <Card radius="xl">
            <CardHeader
              title={volunteer ? "Service" : "Activity"}
              description={
                volunteer
                  ? "What this driver has contributed to the community."
                  : "Trips completed and earnings recorded on the professional track."
              }
            />

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                icon={RouteIcon}
                label="Total trips"
                value={driver.totalTrips}
              />
              <StatTile
                icon={Star}
                label="Rating"
                value={driver.rating.toFixed(1)}
                raw
              />

              {volunteer && driver.service ? (
                <>
                  <StatTile
                    icon={Clock}
                    label="Service hours"
                    value={driver.service.serviceHours}
                  />
                  <StatTile
                    icon={Users}
                    label="People carried"
                    value={driver.service.passengersServed}
                  />
                </>
              ) : driver.earningsSummary ? (
                <>
                  <StatTile
                    icon={RouteIcon}
                    label="Trips this week"
                    value={driver.earningsSummary.weekTrips}
                  />
                  <StatTile
                    icon={Star}
                    label="Week to date"
                    value={formatNaira(driver.earningsSummary.weekToDate)}
                    raw
                  />
                </>
              ) : null}
            </div>

            {volunteer ? (
              <p className="type-meta mt-4 text-ink-muted">
                Volunteer drivers are never paid, and no fare is ever shown to
                them or to their passengers.
              </p>
            ) : (
              <p className="type-meta mt-4 text-ink-muted">
                Earnings are a record of completed rides, not a balance the
                network holds.
              </p>
            )}

            {volunteer && driver.service?.badges?.length ? (
              <div className="mt-5">
                <p className="type-micro text-ink-muted">Recognition</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {driver.service.badges.map((badge) => (
                    <StatusChip key={badge.id} tone="success">
                      {badge.name}
                    </StatusChip>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          {/* Vehicle */}
          <Card radius="xl">
            <CardHeader
              title="Vehicle"
              action={
                driver.vehicle.verified ? (
                  <StatusChip tone="success">Inspected</StatusChip>
                ) : (
                  <StatusChip tone="pending">Not inspected</StatusChip>
                )
              }
            />

            <NestedTile className="mt-5 flex items-center gap-3.5">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink-secondary ring-1 ring-line">
                <Car className="size-5" strokeWidth={1.7} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="type-card-title truncate text-ink">
                  {driver.vehicle.colour} {driver.vehicle.make}{" "}
                  {driver.vehicle.model}
                </p>
                <p className="type-meta type-numeric mt-0.5 text-ink-muted">
                  {formatPlate(driver.vehicle.plateNumber)} ·{" "}
                  {driver.vehicle.seats} {pluralise(driver.vehicle.seats, "seat")}
                </p>
              </div>
            </NestedTile>

            <NestedTile className="mt-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="type-micro text-ink-muted">3-month inspection</p>
                  <p className="type-meta mt-1 font-semibold text-ink">
                    {driver.inspection?.scheduledAt
                      ? formatDateTime(driver.inspection.scheduledAt)
                      : driver.inspection?.nextDueAt
                        ? `Due ${formatDate(driver.inspection.nextDueAt)}`
                        : "No appointment scheduled"}
                  </p>
                  {driver.inspection?.location ? (
                    <p className="type-meta mt-1 text-ink-muted">
                      {driver.inspection.location}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={CalendarClock}
                  onClick={() => setInspectionOpen(true)}
                >
                  Schedule
                </Button>
              </div>
            </NestedTile>
          </Card>

          {/* Recent trips */}
          <Card radius="xl">
            <CardHeader
              title="Recent trips"
              description="The last few journeys on this record."
            />

            <div className="mt-5">
              {recentTrips.length === 0 ? (
                <EmptyState
                  icon={RouteIcon}
                  size="sm"
                  title="No trips recorded yet."
                  description="Journeys appear here once the driver completes one."
                />
              ) : (
                <ul className="space-y-2.5">
                  {recentTrips.map((trip) => (
                    <li key={trip.id}>
                      <NestedTile className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="type-body truncate font-medium text-ink">
                            {trip.destination.label}
                          </p>
                          <p className="type-meta truncate text-ink-muted">
                            <span className="type-numeric">
                              {trip.reference}
                            </span>{" "}
                            · {RIDE_TYPE_LABEL[trip.rideType]} ·{" "}
                            {formatDate(trip.requestedAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {/* Volunteer rides carry no fare at all. */}
                          {trip.track === DriverTrack.PROFESSIONAL &&
                          trip.fare !== undefined ? (
                            <span className="type-numeric type-meta text-ink">
                              {formatNaira(trip.fare)}
                            </span>
                          ) : null}
                          <StatusBadge
                            presentation={RIDE_STATUS_PRESENTATION[trip.status]}
                          />
                        </div>
                      </NestedTile>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="min-w-0">
          <Card radius="xl" className="lg:sticky lg:top-20">
            <CardHeader title="Oversight" />

            <div className="mt-5 space-y-3">
              <NestedTile>
                <DataPoint
                  label="Verification"
                  value={
                    VERIFICATION_PRESENTATION[driver.verificationStatus].label
                  }
                  hint={
                    VERIFICATION_PRESENTATION[driver.verificationStatus].detail
                  }
                />
              </NestedTile>

              <NestedTile>
                <DataPoint
                  label="Identity"
                  value={driver.ninVerified ? "NIN verified" : "NIN needs review"}
                  hint={
                    driver.affiliation?.isKoinoniaWorker
                      ? `Koinonia worker · ${driver.affiliation.department}`
                      : driver.affiliation?.guarantor
                        ? `Guarantor: ${driver.affiliation.guarantor.name}`
                        : "Community eligibility not recorded"
                  }
                />
              </NestedTile>

              {driver.trackSwitch ? (
                <NestedTile className="flex items-start gap-3">
                  <ClipboardCheck
                    className="mt-0.5 size-4 shrink-0 text-ink-muted"
                    strokeWidth={1.8}
                    aria-hidden
                  />
                  <p className="type-meta text-ink-secondary">
                    A track switch to{" "}
                    {TRACK_LABEL[driver.trackSwitch.toTrack]} is{" "}
                    {driver.trackSwitch.status === "APPROVED"
                      ? "approved"
                      : "awaiting a decision"}
                    . Switching is reviewed, never an instant toggle.
                  </p>
                </NestedTile>
              ) : null}
            </div>

            <div className="mt-5 space-y-2.5">
              <Button
                variant="secondary"
                size="lg"
                icon={Flag}
                className="w-full"
                disabled={flagged || deactivated}
                onClick={async () => {
                  await userService.updateDriverAccountStatus(
                    driver.id,
                    DriverAccountStatus.FLAGGED,
                  );
                  setAccountOverride(DriverAccountStatus.FLAGGED);
                  setFlagOverride(true);
                  toast({
                    title: "Flagged for quality review",
                    description: "This driver now appears on the quality board.",
                  });
                }}
              >
                {flagged ? "Flagged for review" : "Flag for review"}
              </Button>

              <Button
                variant="ghost"
                size="lg"
                icon={AlertTriangle}
                className="w-full text-danger-600 dark:text-red-300"
                disabled={deactivated}
                onClick={() => setDeactivating(true)}
              >
                {deactivated ? "Deactivated" : "Deactivate driver"}
              </Button>
            </div>

            <p className="type-meta mt-5 text-ink-muted">
              Deactivation stops new ride offers immediately. Missing a vehicle
              inspection is recorded as a deactivation reason and shown to the driver.
            </p>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={deactivating}
        onClose={() => setDeactivating(false)}
        onConfirm={async () => {
          const reason =
            driver.inspection?.status === InspectionStatus.MISSED ||
            (driver.inspection?.nextDueAt && new Date(driver.inspection.nextDueAt) < new Date())
              ? "Your account was deactivated because you missed the scheduled vehicle inspection."
              : "Your driving access was deactivated by the oversight team pending review.";
          await userService.updateDriverAccountStatus(
            driver.id,
            DriverAccountStatus.DEACTIVATED,
            reason,
          );
          setAccountOverride(DriverAccountStatus.DEACTIVATED);
          setDeactivating(false);
          toast({
            title: `${driver.fullName} deactivated`,
            description: "They will receive no further ride offers.",
            tone: "danger",
          });
        }}
        title="Deactivate this driver?"
        description="They stop receiving ride offers straight away and will see the reason on their dashboard."
        confirmLabel="Deactivate"
        tone="danger"
      />

      <Modal
        open={inspectionOpen}
        onClose={() => setInspectionOpen(false)}
        title="Schedule vehicle inspection"
        description={`Create an appointment for ${driver.fullName}. The driver will see it on their dashboard.`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setInspectionOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={savingInspection}
              loadingLabel="Scheduling"
              disabled={!inspectionDate || !inspectionLocation.trim()}
              onClick={async () => {
                setSavingInspection(true);
                try {
                  await userService.scheduleDriverInspection(driver.id, {
                    scheduledAt: new Date(inspectionDate).toISOString(),
                    location: inspectionLocation,
                    note: inspectionNote || undefined,
                  });
                  await refetch();
                  setInspectionOpen(false);
                  toast({
                    title: "Inspection scheduled",
                    description: "The appointment is now visible to the driver.",
                    tone: "success",
                  });
                } finally {
                  setSavingInspection(false);
                }
              }}
            >
              Schedule appointment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Date and time"
            type="datetime-local"
            value={inspectionDate}
            onChange={(event) => setInspectionDate(event.target.value)}
            required
          />
          <Input
            label="Inspection location"
            value={inspectionLocation}
            onChange={(event) => setInspectionLocation(event.target.value)}
            required
          />
          <Textarea
            label="Instructions for the driver"
            placeholder="Bring the vehicle, keys and original documents."
            value={inspectionNote}
            onChange={(event) => setInspectionNote(event.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  raw,
}: {
  icon: typeof RouteIcon;
  label: string;
  value: number | string;
  raw?: boolean;
}) {
  return (
    <NestedTile className="text-center">
      <Icon
        className="mx-auto size-4 text-ink-muted"
        strokeWidth={1.7}
        aria-hidden
      />
      <p className="type-numeric mt-2 text-[1.125rem] leading-none font-semibold text-ink">
        {raw || typeof value === "string" ? value : <CountUp value={value} />}
      </p>
      <p className="type-micro mt-1.5 text-ink-muted">{label}</p>
    </NestedTile>
  );
}
