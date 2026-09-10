"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  CalendarClock,
  Car,
  Clock,
  Heart,
  Inbox,
  MapPin,
  Users,
} from "lucide-react";
import { Card, CardHeader, NestedTile } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/badge";
import { CountUp } from "@/components/ui/stats-card";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/app-shell";
import { RequestCard } from "@/components/drivers/request-card";
import { queryKeys } from "@/constants/query-keys";
import { rideService } from "@/services";
import { DriverTrack } from "@/types/enums";
import { greetingForHour, formatTime } from "@/lib/format";
import { UPCOMING_EVENT } from "@/mocks/rides";
import type { Driver } from "@/types/models";

/**
 * Volunteer dashboard. Deliberately service-oriented — no fares, no earnings,
 * no currency anywhere on this screen.
 */
export function VolunteerDashboard({ driver }: { driver: Driver }) {
  const { toast } = useToast();
  const [confirmed, setConfirmed] = useState(
    driver.service?.nextEventConfirmed ?? false,
  );

  const { data: requests, isLoading } = useQuery({
    queryKey: queryKeys.driver.requests(DriverTrack.VOLUNTEER),
    queryFn: () => rideService.listRequests(DriverTrack.VOLUNTEER),
  });

  const service = driver.service;
  const firstName = driver.fullName.split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={greetingForHour()}
        title={`${greetingForHour()}, ${firstName}.`}
        description="Thank you for making your journey available to others."
        action={
          <ButtonLink href="/driver/destination" variant="primary" size="lg" pill icon={MapPin}>
            Set destination
          </ButtonLink>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          {/* Service confirmation */}
          <Card radius="xl">
            <CardHeader
              eyebrow="Tonight's service"
              title={`Are you available after ${UPCOMING_EVENT.name.toLowerCase()}?`}
              description={`${UPCOMING_EVENT.venue} · ends ${formatTime(UPCOMING_EVENT.endsAt)}`}
              action={
                confirmed ? (
                  <StatusChip tone="success" dot>
                    Confirmed
                  </StatusChip>
                ) : (
                  <StatusChip tone="pending" dot>
                    Awaiting your reply
                  </StatusChip>
                )
              }
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <NestedTile>
                <div className="flex items-center gap-2">
                  <Car className="size-4 text-ink-muted" strokeWidth={1.7} aria-hidden />
                  <p className="type-micro text-ink-muted">Vehicle</p>
                </div>
                <p className="type-body mt-1.5 font-medium text-ink">
                  {driver.vehicle.make} {driver.vehicle.model}
                </p>
              </NestedTile>

              <NestedTile>
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-ink-muted" strokeWidth={1.7} aria-hidden />
                  <p className="type-micro text-ink-muted">Destination</p>
                </div>
                <p className="type-body mt-1.5 font-medium text-ink">Gwarinpa</p>
              </NestedTile>

              <NestedTile>
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-ink-muted" strokeWidth={1.7} aria-hidden />
                  <p className="type-micro text-ink-muted">Availability</p>
                </div>
                <p className="type-body mt-1.5 font-medium text-ink">3 seats</p>
              </NestedTile>
            </div>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <Button
                variant="primary"
                size="md"
                className="sm:flex-1"
                onClick={() => {
                  setConfirmed(true);
                  toast({
                    title: "Availability confirmed",
                    description: "Passengers heading to Gwarinpa can now find you.",
                    tone: "success",
                  });
                }}
                disabled={confirmed}
              >
                {confirmed ? "Confirmed" : "Confirm"}
              </Button>
              <ButtonLink
                href="/driver/volunteer/confirm"
                variant="secondary"
                size="md"
                className="sm:flex-1"
              >
                Update details
              </ButtonLink>
              <Button
                variant="ghost"
                size="md"
                className="sm:flex-1"
                onClick={() => {
                  setConfirmed(false);
                  toast({
                    title: "Marked unavailable",
                    description: "You won't receive requests for tonight.",
                  });
                }}
              >
                Not available
              </Button>
            </div>
          </Card>

          {/* Pending requests */}
          <Card radius="xl">
            <CardHeader
              title="Passenger requests"
              description="Members heading in your direction."
              action={
                requests && requests.length > 0 ? (
                  <StatusChip tone="pending" dot live>
                    {requests.length} waiting
                  </StatusChip>
                ) : null
              }
            />

            <div className="mt-5 space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  <div className="kx-skeleton h-32 rounded-[var(--kx-radius-lg)]" />
                  <div className="kx-skeleton h-32 rounded-[var(--kx-radius-lg)]" />
                </div>
              ) : !requests || requests.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  size="sm"
                  title="No requests right now."
                  description="When a member is heading your way, their request will appear here."
                />
              ) : (
                requests.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          {/* Service record */}
          <Card radius="xl" elevation="dark" className="border-white/8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="type-micro text-white/45">Your service</p>
                <p className="type-card-title mt-1.5 text-white">
                  A record of the journeys you&rsquo;ve given
                </p>
              </div>
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-gold-400">
                <Heart className="size-4.5" strokeWidth={1.7} aria-hidden />
              </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { icon: Clock, label: "Service hours", value: service?.serviceHours ?? 0 },
                { icon: CalendarClock, label: "Volunteer trips", value: service?.volunteerTrips ?? 0 },
                { icon: Users, label: "Passengers", value: service?.passengersServed ?? 0 },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="rounded-[var(--kx-radius-md)] bg-white/[0.06] p-3"
                  >
                    <Icon className="size-4 text-white/45" strokeWidth={1.7} aria-hidden />
                    <p className="type-numeric mt-2.5 text-[1.375rem] leading-none font-semibold text-white">
                      <CountUp value={stat.value} />
                    </p>
                    <p className="type-micro mt-1.5 text-white/45">{stat.label}</p>
                  </div>
                );
              })}
            </div>

            <ButtonLink
              href="/driver/volunteer/recognition"
              variant="inverse"
              size="sm"
              block
              className="mt-5"
            >
              View recognition
            </ButtonLink>
          </Card>

          {/* Badges */}
          <Card radius="xl">
            <CardHeader title="Recognition" description="Earned through service." />

            <div className="mt-4 space-y-3">
              {(service?.badges ?? []).length === 0 ? (
                <EmptyState
                  icon={Award}
                  size="sm"
                  title="Every volunteer journey adds to your service story."
                />
              ) : (
                service?.badges.slice(0, 3).map((badge) => (
                  <NestedTile key={badge.id} className="flex items-center gap-3">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-500/16 text-gold-700 dark:text-gold-300">
                      <Award className="size-4.5" strokeWidth={1.6} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="type-meta font-medium text-ink">{badge.name}</p>
                      <p className="type-meta truncate text-ink-muted">
                        {badge.description}
                      </p>
                    </div>
                  </NestedTile>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
