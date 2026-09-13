"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  ChevronRight,
  LifeBuoy,
  Lock,
  LogOut,
  MapPin,
  Route as RouteIcon,
  ShieldCheck,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardHeader, NestedTile } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, VerifiedBadge } from "@/components/ui/badge";
import { CountUp } from "@/components/ui/stats-card";
import { PageLoader } from "@/components/ui/route-loader";
import { PageHeader } from "@/components/layout/app-shell";
import { queryKeys } from "@/constants/query-keys";
import { userService } from "@/services";
import { MEMBERSHIP_PRESENTATION } from "@/constants/status-presentation";
import { MembershipStatus } from "@/types/enums";
import { pluralise } from "@/lib/format";

export function PassengerProfile() {
  const { data: passenger, isLoading } = useQuery({
    queryKey: queryKeys.passenger.profile(),
    queryFn: () => userService.getCurrentPassenger(),
  });

  if (isLoading || !passenger) {
    return <PageLoader message="Loading your profile" />;
  }

  const verified = passenger.membershipStatus === MembershipStatus.VERIFIED;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Your account" title="Profile" />

      <div className="space-y-5">
        {/* Identity */}
        <Card radius="xl">
          <div className="flex min-w-0 flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <Avatar
              name={passenger.fullName}
              src={passenger.avatarUrl}
              size="xl"
              verified={verified}
            />

            <div className="w-full min-w-0 flex-1">
              <h2 className="type-section-title truncate text-ink">
                {passenger.fullName}
              </h2>
              <p className="type-meta mt-1 truncate text-ink-muted">
                Member since {new Date(passenger.joinedAt).getFullYear()} ·{" "}
                {passenger.email}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <VerifiedBadge label="Verified Member" size="md" />
              </div>
            </div>
          </div>

          {/* No money anywhere on a passenger profile. */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <NestedTile className="text-center">
              <RouteIcon
                className="mx-auto size-4 text-ink-muted"
                strokeWidth={1.7}
                aria-hidden
              />
              <p className="type-numeric mt-2 text-[1.25rem] leading-none font-semibold text-ink">
                <CountUp value={passenger.totalRides} />
              </p>
              <p className="type-micro mt-1.5 text-ink-muted">Rides</p>
            </NestedTile>

            <NestedTile className="text-center">
              <Star
                className="mx-auto size-4 text-ink-muted"
                strokeWidth={1.7}
                aria-hidden
              />
              <p className="type-numeric mt-2 text-[1.25rem] leading-none font-semibold text-ink">
                {passenger.rating.toFixed(1)}
              </p>
              <p className="type-micro mt-1.5 text-ink-muted">Rating</p>
            </NestedTile>

            <NestedTile className="text-center">
              <Users
                className="mx-auto size-4 text-ink-muted"
                strokeWidth={1.7}
                aria-hidden
              />
              <p className="type-numeric mt-2 text-[1.25rem] leading-none font-semibold text-ink">
                <CountUp value={passenger.trustedContacts.length} />
              </p>
              <p className="type-micro mt-1.5 text-ink-muted">Contacts</p>
            </NestedTile>
          </div>
        </Card>

        {/* Membership */}
        <Card radius="xl">
          <CardHeader
            title="Membership"
            description="Only confirmed members can request rides."
            action={
              <StatusBadge
                presentation={MEMBERSHIP_PRESENTATION[passenger.membershipStatus]}
              />
            }
          />
          <div className="mt-5">
            <ProfileLink
              href="/verify-member"
              icon={ShieldCheck}
              label="Membership status"
              detail={MEMBERSHIP_PRESENTATION[passenger.membershipStatus].detail}
            />
          </div>
        </Card>

        {/* Safety */}
        <Card radius="xl">
          <CardHeader title="Safety" description="Set up before you travel." />
          <div className="mt-5 space-y-2">
            <ProfileLink
              href="/passenger/safety"
              icon={LifeBuoy}
              label="Safety centre"
              detail="Trusted contacts, trip sharing and SOS"
            />
            <ProfileLink
              href="/passenger/safety"
              icon={Users}
              label="Trusted contacts"
              detail={`${passenger.trustedContacts.length} ${pluralise(passenger.trustedContacts.length, "contact")} saved`}
            />
            <ProfileLink
              href="/passenger/safety"
              icon={MapPin}
              label="Location permissions"
              detail="Used to find a driver near you during a journey"
            />
          </div>
        </Card>

        {/* Journeys */}
        <Card radius="xl">
          <CardHeader title="Journeys" />
          <div className="mt-5 space-y-2">
            <ProfileLink
              href="/passenger/rides"
              icon={RouteIcon}
              label="Your rides"
              detail="Active, completed and cancelled"
            />
          </div>
        </Card>

        {/* Settings */}
        <Card radius="xl">
          <CardHeader title="Settings" />
          <div className="mt-5 space-y-2">
            <ProfileLink
              href="/passenger/profile"
              icon={Bell}
              label="Notifications"
              detail="Ride updates, payment and safety notices"
            />
            <ProfileLink
              href="/passenger/profile"
              icon={Lock}
              label="Privacy"
              detail="What drivers and the oversight team can see"
            />
            <ProfileLink
              href="/passenger/profile"
              icon={LifeBuoy}
              label="Support"
              detail="Get help from the transportation team"
            />
          </div>

          <button
            type="button"
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[var(--kx-radius-md)] border border-line text-[0.875rem] font-medium text-danger-600 transition-colors hover:bg-danger-50 dark:text-red-300 dark:hover:bg-danger-500/10"
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
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  detail?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        // 60px tall: a comfortable tap target on a phone.
        "flex min-h-[60px] items-center gap-3.5 rounded-[var(--kx-radius-md)] border border-line bg-surface px-4 py-3.5",
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

      <ChevronRight
        className="size-4 shrink-0 text-ink-muted"
        strokeWidth={2}
        aria-hidden
      />
    </Link>
  );
}
