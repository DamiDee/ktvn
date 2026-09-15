"use client";

import Link from "next/link";
import {
  Award,
  Bell,
  Car,
  ChevronRight,
  FileText,
  HandHeart,
  LifeBuoy,
  LogOut,
  Repeat,
  Route as RouteIcon,
  ShieldCheck,
  Star,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardHeader, NestedTile } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, StatusChip, VerifiedBadge } from "@/components/ui/badge";
import { CountUp } from "@/components/ui/stats-card";
import { PageLoader } from "@/components/ui/route-loader";
import { PageHeader } from "@/components/layout/app-shell";
import { useCurrentDriver } from "./use-current-driver";
import {
  TRACK_LABEL,
  TRACK_TONE,
  VERIFICATION_PRESENTATION,
} from "@/constants/status-presentation";
import { DriverTrack, VerificationStatus } from "@/types/enums";
import { formatNaira } from "@/lib/format";
import { useSessionStore } from "@/stores/session-store";

/** The driver's own profile: identity, vehicle, verification and settings. */
export function DriverProfile() {
  const { data: driver, isLoading } = useCurrentDriver();
  const selectedTrack = useSessionStore((state) => state.driverTrack);

  if (isLoading || !driver) return <PageLoader message="Loading your profile" />;

  const activeTrack = driver.eligibleTracks?.includes(selectedTrack)
    ? selectedTrack
    : driver.track;
  const isVolunteer = activeTrack === DriverTrack.VOLUNTEER;
  const approved = driver.verificationStatus === VerificationStatus.APPROVED;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Your account" title="Profile" />

      <div className="space-y-5">
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
                Member since {new Date(driver.joinedAt).getFullYear()} ·{" "}
                {driver.email}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <VerifiedBadge
                  label="Verified Driver"
                  tone={isVolunteer ? "gold" : "lilac"}
                  size="md"
                />
                {(driver.eligibleTracks ?? [driver.track]).map((track) => (
                  <StatusChip key={track} tone={TRACK_TONE[track]} size="md">
                    {TRACK_LABEL[track]}
                  </StatusChip>
                ))}
              </div>
            </div>
          </div>

          {/* Headline numbers — no money on the volunteer track */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <NestedTile className="text-center">
              <RouteIcon
                className="mx-auto size-4 text-ink-muted"
                strokeWidth={1.7}
                aria-hidden
              />
              <p className="type-numeric mt-2 text-[1.0625rem] leading-none font-semibold text-ink">
                <CountUp value={driver.totalTrips} />
              </p>
              <p className="type-micro mt-1.5 text-ink-muted">Trips</p>
            </NestedTile>

            <NestedTile className="text-center">
              <Star
                className="mx-auto size-4 text-ink-muted"
                strokeWidth={1.7}
                aria-hidden
              />
              <p className="type-numeric mt-2 text-[1.0625rem] leading-none font-semibold text-ink">
                {driver.rating.toFixed(1)}
              </p>
              <p className="type-micro mt-1.5 text-ink-muted">Rating</p>
            </NestedTile>

            <NestedTile className="text-center">
              {isVolunteer ? (
                <>
                  <Award
                    className="mx-auto size-4 text-ink-muted"
                    strokeWidth={1.7}
                    aria-hidden
                  />
                  <p className="type-numeric mt-2 text-[1.0625rem] leading-none font-semibold text-ink">
                    <CountUp value={driver.service?.serviceHours ?? 0} />
                  </p>
                  <p className="type-micro mt-1.5 text-ink-muted">Hours</p>
                </>
              ) : (
                <>
                  <Wallet
                    className="mx-auto size-4 text-ink-muted"
                    strokeWidth={1.7}
                    aria-hidden
                  />
                  <p className="type-numeric mt-2 text-[1.0625rem] leading-none font-semibold text-ink">
                    {formatNaira(driver.earningsSummary?.weekToDate ?? 0)}
                  </p>
                  <p className="type-micro mt-1.5 text-ink-muted">This week</p>
                </>
              )}
            </NestedTile>
          </div>
        </Card>

        {/* Verification */}
        <Card radius="xl">
          <CardHeader
            title="Verification"
            description="Both tracks are held to the same standard."
            action={
              <StatusBadge
                presentation={VERIFICATION_PRESENTATION[driver.verificationStatus]}
              />
            }
          />

          <div className="mt-5 space-y-2">
            <ProfileLink
              href="/driver/verification"
              icon={ShieldCheck}
              label="Application status"
              detail={VERIFICATION_PRESENTATION[driver.verificationStatus].detail}
            />
            <ProfileLink
              href="/driver/vehicle"
              icon={Car}
              label="Vehicle"
              detail={`${driver.vehicle.colour} ${driver.vehicle.make} ${driver.vehicle.model} · ${driver.vehicle.plateNumber}`}
              badge={
                driver.vehicle.verified ? (
                  <VerifiedBadge label="Vehicle Verified" />
                ) : undefined
              }
            />
            <ProfileLink
              href="/driver/verification"
              icon={FileText}
              label="Documents"
              detail="Licence, registration, insurance and roadworthiness"
            />
          </div>
        </Card>

        {/* Track */}
        <Card radius="xl">
          <CardHeader
            title="Approved driving tracks"
            description="Choose the active track each time you go online."
          />
          <div className="mt-5">
            <ProfileLink
              href="/driver"
              icon={isVolunteer ? HandHeart : Wallet}
              label={`Active selection: ${TRACK_LABEL[activeTrack].toLowerCase()}`}
              detail="Go offline to choose another approved track"
            />
          </div>
        </Card>

        {/* Track-specific record */}
        <Card radius="xl">
          <CardHeader
            title={isVolunteer ? "Your service" : "Your earnings"}
            description={
              isVolunteer
                ? "A record of journeys given."
                : "A record of completed rides — not a wallet."
            }
          />
          <div className="mt-5 space-y-2">
            {isVolunteer ? (
              <ProfileLink
                href="/driver/volunteer/recognition"
                icon={Award}
                label="Recognition"
                detail={`${driver.service?.serviceHours ?? 0} service hours · ${driver.service?.badges.filter((b) => b.earnedAt).length ?? 0} badges`}
              />
            ) : (
              <>
                <ProfileLink
                  href="/driver/professional/earnings"
                  icon={Wallet}
                  label="Earnings"
                  detail="Completed rides, week by week"
                />
                <ProfileLink
                  href="/driver/professional/receipts"
                  icon={FileText}
                  label="Receipts"
                  detail="One for every paid journey"
                />
              </>
            )}
            <ProfileLink
              href="/driver/trips"
              icon={RouteIcon}
              label="Trips"
              detail="Active, completed and cancelled"
            />
          </div>
        </Card>

        {/* Settings */}
        <Card radius="xl">
          <CardHeader title="Settings" />
          <div className="mt-5 space-y-2">
            <ProfileLink
              href="/driver/profile"
              icon={Bell}
              label="Notifications"
              detail="Requests, verification and service reminders"
            />
            <ProfileLink
              href="/driver/profile"
              icon={Repeat}
              label="Availability defaults"
              detail="Seats and destination you offer most often"
            />
            <ProfileLink
              href="/driver/profile"
              icon={LifeBuoy}
              label="Support"
              detail="Get help from the transportation team"
            />
          </div>

          <button
            type="button"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--kx-radius-md)] border border-line px-4 py-3 text-[0.875rem] font-medium text-danger-600 transition-colors hover:bg-danger-50 dark:text-red-300 dark:hover:bg-danger-500/10"
          >
            <LogOut className="size-4" strokeWidth={1.9} aria-hidden />
            Sign out
          </button>
        </Card>

        <p className="type-meta text-center text-ink-muted">
          Verification reduces risk; it doesn&rsquo;t guarantee a safe journey,
          and the network doesn&rsquo;t provide insurance for rides.
        </p>
      </div>
    </div>
  );
}

function ProfileLink({
  href,
  icon: Icon,
  label,
  detail,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  detail?: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3.5 rounded-[var(--kx-radius-md)] border border-line bg-surface px-4 py-3.5",
        "transition-[border-color,background-color] duration-[165ms] hover:border-line-strong hover:bg-surface-nested",
      )}
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-nested text-ink-secondary">
        <Icon className="size-4" strokeWidth={1.8} aria-hidden />
      </span>

      <span className="min-w-0 flex-1">
        <span className="type-body block truncate font-medium text-ink">
          {label}
        </span>
        {detail ? (
          <span className="type-meta block truncate text-ink-muted">
            {detail}
          </span>
        ) : null}
      </span>

      {badge}
      <ChevronRight
        className="size-4 shrink-0 text-ink-muted"
        strokeWidth={2}
        aria-hidden
      />
    </Link>
  );
}
