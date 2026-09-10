"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  MapPin,
  Route as RouteIcon,
  ShieldCheck,
  Star,
  UserRound,
  Users,
} from "lucide-react";
import { Card, CardHeader, DataPoint, NestedTile } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, StatusChip, VerifiedBadge } from "@/components/ui/badge";
import { CountUp } from "@/components/ui/stats-card";
import { ConfirmDialog } from "@/components/ui/modal";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { PageLoader } from "@/components/ui/route-loader";
import { PageHeader } from "@/components/layout/app-shell";
import { queryKeys } from "@/constants/query-keys";
import { rideService, userService } from "@/services";
import {
  MEMBERSHIP_PRESENTATION,
  RIDE_STATUS_PRESENTATION,
  RIDE_TYPE_LABEL,
  TRACK_LABEL,
  TRACK_TONE,
} from "@/constants/status-presentation";
import { MembershipStatus } from "@/types/enums";
import { formatDate, pluralise } from "@/lib/format";

/** One member's record, as the oversight team sees it. */
export function PassengerDetail({ passengerId }: { passengerId: string }) {
  const { toast } = useToast();
  const [restricting, setRestricting] = useState(false);
  const [restricted, setRestricted] = useState(false);

  const { data: passenger, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.passenger(passengerId),
    queryFn: () => userService.getPassenger(passengerId),
  });

  const { data: rides } = useQuery({
    queryKey: [...queryKeys.admin.passenger(passengerId), "rides"],
    queryFn: () => rideService.listRides(),
    enabled: Boolean(passenger),
  });

  if (isLoading) return <PageLoader message="Loading the member record" />;

  if (isError || !passenger) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorState
          title="We couldn't find that member."
          description="The record may have been removed, or the link may be out of date."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const verified = passenger.membershipStatus === MembershipStatus.VERIFIED;
  const recent = (rides ?? []).slice(0, 4);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/passengers"
        className="kx-tap type-meta mb-4 inline-flex items-center gap-1.5 font-medium text-ink-secondary transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
        Passengers
      </Link>

      <PageHeader
        eyebrow="Member record"
        title={passenger.fullName}
        action={
          restricted ? (
            <StatusChip tone="danger" size="md">
              Restricted
            </StatusChip>
          ) : (
            <StatusBadge
              presentation={MEMBERSHIP_PRESENTATION[passenger.membershipStatus]}
              size="md"
            />
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          {/* Identity */}
          <Card radius="xl">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <Avatar
                name={passenger.fullName}
                src={passenger.avatarUrl}
                size="xl"
                verified={verified}
              />
              <div className="min-w-0 flex-1">
                <h2 className="type-section-title truncate text-ink">
                  {passenger.fullName}
                </h2>
                <p className="type-meta type-numeric mt-1 text-ink-muted">
                  {passenger.memberId} · Joined{" "}
                  {formatDate(passenger.joinedAt)}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  {verified ? <VerifiedBadge label="Verified member" /> : null}
                  {passenger.homeArea ? (
                    <StatusChip tone="neutral" icon={MapPin}>
                      {passenger.homeArea}
                    </StatusChip>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <NestedTile className="text-center">
                <RouteIcon
                  className="mx-auto size-4 text-ink-muted"
                  strokeWidth={1.7}
                  aria-hidden
                />
                <p className="type-numeric mt-2 text-[1.125rem] leading-none font-semibold text-ink">
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
                <p className="type-numeric mt-2 text-[1.125rem] leading-none font-semibold text-ink">
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
                <p className="type-numeric mt-2 text-[1.125rem] leading-none font-semibold text-ink">
                  <CountUp value={passenger.trustedContacts.length} />
                </p>
                <p className="type-micro mt-1.5 text-ink-muted">Contacts</p>
              </NestedTile>
            </div>
          </Card>

          {/* Trusted contacts */}
          <Card radius="xl">
            <CardHeader
              title="Trusted contacts"
              description="Only used when this member shares a trip or raises an SOS."
            />

            <div className="mt-5">
              {passenger.trustedContacts.length === 0 ? (
                <EmptyState
                  icon={UserRound}
                  size="sm"
                  title="No trusted contacts saved."
                  description="Members travel more safely with at least one contact."
                />
              ) : (
                <ul className="space-y-2.5">
                  {passenger.trustedContacts.map((contact) => (
                    <li key={contact.id}>
                      <NestedTile className="flex items-center gap-3">
                        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink-secondary ring-1 ring-line">
                          <UserRound
                            className="size-4.5"
                            strokeWidth={1.8}
                            aria-hidden
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="type-body truncate font-medium text-ink">
                            {contact.name}
                          </p>
                          <p className="type-meta truncate text-ink-muted">
                            {contact.relationship ?? "Trusted contact"}
                          </p>
                        </div>
                      </NestedTile>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="type-meta mt-4 text-ink-muted">
              Contact phone numbers are revealed only when an incident is
              opened.
            </p>
          </Card>

          {/* Recent rides */}
          <Card radius="xl">
            <CardHeader title="Recent rides" />

            <div className="mt-5">
              {recent.length === 0 ? (
                <EmptyState
                  icon={RouteIcon}
                  size="sm"
                  title="No rides yet."
                  description="Journeys appear here once this member travels."
                />
              ) : (
                <ul className="space-y-2.5">
                  {recent.map((ride) => (
                    <li key={ride.id}>
                      <NestedTile className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="type-body truncate font-medium text-ink">
                            {ride.destination.label}
                          </p>
                          <p className="type-meta truncate text-ink-muted">
                            <span className="type-numeric">
                              {ride.reference}
                            </span>{" "}
                            · {RIDE_TYPE_LABEL[ride.rideType]} ·{" "}
                            {formatDate(ride.requestedAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusChip tone={TRACK_TONE[ride.track]}>
                            {TRACK_LABEL[ride.track]}
                          </StatusChip>
                          <StatusBadge
                            presentation={RIDE_STATUS_PRESENTATION[ride.status]}
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

        {/* Oversight */}
        <div className="min-w-0">
          <Card radius="xl" className="lg:sticky lg:top-20">
            <CardHeader title="Oversight" />

            <NestedTile className="mt-5">
              <DataPoint
                label="Membership"
                value={MEMBERSHIP_PRESENTATION[passenger.membershipStatus].label}
                hint={MEMBERSHIP_PRESENTATION[passenger.membershipStatus].detail}
              />
            </NestedTile>

            <NestedTile className="mt-3">
              <DataPoint
                label="Safety setup"
                value={`${passenger.trustedContacts.length} ${pluralise(
                  passenger.trustedContacts.length,
                  "contact",
                )}`}
                hint="Trip sharing and SOS are available on every journey"
              />
            </NestedTile>

            <div className="mt-5 space-y-2.5">
              <Button
                variant="secondary"
                size="lg"
                icon={ShieldCheck}
                className="w-full"
                onClick={() =>
                  toast({
                    title: "Membership re-check requested",
                    description:
                      "The membership team will confirm this record again.",
                  })
                }
              >
                Re-check membership
              </Button>

              <Button
                variant="ghost"
                size="lg"
                className="w-full text-danger-600 dark:text-red-300"
                disabled={restricted}
                onClick={() => setRestricting(true)}
              >
                {restricted ? "Restricted" : "Restrict ride requests"}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={restricting}
        onClose={() => setRestricting(false)}
        onConfirm={() => {
          setRestricted(true);
          setRestricting(false);
          toast({
            title: `${passenger.fullName} restricted`,
            description: "They can no longer request new rides.",
            tone: "danger",
          });
        }}
        title="Restrict ride requests?"
        description="This member will not be able to request new rides. Any journey already in progress continues and is monitored to its end."
        confirmLabel="Restrict"
        tone="danger"
      />
    </div>
  );
}
