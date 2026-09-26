"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarClock,
  BusFront,
  Route as RouteIcon,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { PageLoader } from "@/components/ui/route-loader";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/app-shell";
import { freebusRequest } from "@/services/freebus-api";
import type { ApiRideRequest, ApiRoute, ApiPoint } from "@/types/freebus-api";
import { useLiveQuery } from "./live-queries";

/** WAT is UTC+01:00 all year — returns the current calendar date as YYYY-MM-DD. */
function watToday(now = new Date()) {
  return new Date(now.getTime() + 3_600_000).toISOString().slice(0, 10);
}

type SortMode = "recent" | "upcoming" | "demand";

/** Format a YYYY-MM-DD date as "Today", "Tomorrow", or "Sun 27 Sep" */
function dateLabel(date: string) {
  const today = watToday();
  if (date === today) return "Today";
  const tomorrowMs = Date.parse(`${today}T00:00:00Z`) + 86_400_000;
  const tomorrow = new Date(tomorrowMs).toISOString().slice(0, 10);
  if (date === tomorrow) return "Tomorrow";
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
}

function isPast(date: string) {
  return date < watToday();
}

export function AdminRideRequests() {
  const client = useQueryClient();
  const { toast } = useToast();
  const [sort, setSort] = useState<SortMode>("upcoming");
  const [deleting, setDeleting] = useState<ApiRideRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const rideRequests = useLiveQuery<ApiRideRequest[]>("ride-requests");
  const routes = useLiveQuery<ApiRoute[]>("routes");
  const points = useLiveQuery<ApiPoint[]>("points");

  const refresh = () => client.invalidateQueries({ queryKey: ["freebus-live"] });

  const error = rideRequests.error ?? routes.error ?? points.error;
  const ready = rideRequests.data && routes.data && points.data;

  const model = useMemo(() => {
    if (!rideRequests.data || !routes.data || !points.data) return null;
    const routesById = new Map(routes.data.map((r) => [r.id, r]));
    const pointsById = new Map(points.data.map((p) => [p.id, p]));

    const enriched = rideRequests.data.map((req) => ({
      ...req,
      route: routesById.get(req.route_id) ?? null,
      pointsById,
    }));

    const sorted = [...enriched].sort((a, b) => {
      if (sort === "upcoming") {
        // Soonest non-past first, then past descending.
        const aFuture = !isPast(a.departure_date);
        const bFuture = !isPast(b.departure_date);
        if (aFuture !== bFuture) return aFuture ? -1 : 1;
        return aFuture
          ? a.departure_date.localeCompare(b.departure_date)
          : b.departure_date.localeCompare(a.departure_date);
      }
      if (sort === "demand") return b.count - a.count;
      // recent: newest created_at first
      return b.created_at.localeCompare(a.created_at);
    });

    const totalDemand = enriched.reduce((n, r) => n + r.count, 0);
    const upcoming = enriched.filter((r) => !isPast(r.departure_date)).length;
    const topRoute = [...enriched]
      .sort((a, b) => b.count - a.count)[0]?.route?.name ?? null;

    return { sorted, totalDemand, upcoming, topRoute };
  }, [rideRequests.data, routes.data, points.data, sort]);

  if (error)
    return (
      <ErrorState
        title="We couldn't load ride requests"
        description={error.message}
        onRetry={() => void refresh()}
      />
    );
  if (!ready || !model) return <PageLoader message="Loading ride requests" />;

  const { sorted, totalDemand, upcoming, topRoute } = model;

  async function deleteRequest() {
    if (!deleting) return;
    setBusy(true);
    try {
      await freebusRequest(`ride-requests/${deleting.id}`, { method: "DELETE" });
      await refresh();
      toast({ title: "Ride request removed" });
      setDeleting(null);
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Couldn't remove request",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Free Buses · Demand"
        title="Ride Requests"
        description="Who wants which route, and on which day. Assign buses where the demand is."
      />

      {/* ── Summary strip ── */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          {
            label: "Total demand",
            value: totalDemand,
            icon: Users,
            hint: "Seats requested across all routes",
          },
          {
            label: "Upcoming dates",
            value: upcoming,
            icon: CalendarClock,
            hint: "Dates still in the future",
          },
          {
            label: "Most wanted",
            value: topRoute ?? "—",
            icon: TrendingUp,
            hint: "Route with highest seat count",
            wide: true,
          },
        ].map(({ label, value, icon: Icon, hint, wide }) => (
          <Card
            key={label}
            radius="xl"
            className={cn("!p-4 sm:!p-5", wide && "col-span-3 sm:col-span-1")}
          >
            <Icon className="size-4.5 text-forest-700 dark:text-gold-300" aria-hidden />
            <p
              className={cn(
                "mt-3 font-semibold text-ink",
                typeof value === "number"
                  ? "type-numeric text-3xl"
                  : "type-card-title truncate text-base",
              )}
            >
              {value}
            </p>
            <p className="type-meta mt-1 text-ink-muted">{label}</p>
            <p className="type-micro mt-0.5 text-ink-muted">{hint}</p>
          </Card>
        ))}
      </div>

      {/* ── Sort controls ── */}
      <div
        className="mb-5 flex gap-2"
        role="group"
        aria-label="Sort ride requests"
      >
        {(
          [
            { value: "upcoming", label: "Upcoming first" },
            { value: "recent", label: "Most recent" },
            { value: "demand", label: "Highest demand" },
          ] as { value: SortMode; label: string }[]
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSort(opt.value)}
            aria-pressed={sort === opt.value}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors",
              sort === opt.value
                ? "border-gold-500 bg-gold-500 text-forest-950"
                : "border-line bg-surface text-ink-secondary hover:border-line-strong hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Cards ── */}
      {sorted.length === 0 ? (
        <Card radius="xl">
          <EmptyState
            icon={RouteIcon}
            size="sm"
            title="Nobody has asked for a route yet"
            description="When a member taps “I need this bus” on a route, their interest lands here so you can see which routes to put a bus on."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((req) => {
            const past = isPast(req.departure_date);
            const from = req.route
              ? req.pointsById.get(req.route.start_point)?.name ?? "Boarding"
              : null;
            const to = req.route
              ? req.pointsById.get(req.route.end_point)?.name ?? "Destination"
              : null;
            // Rough fill percentage: 1 request per ~18-seat bus.
            const pct = Math.min(100, Math.round((req.count / 18) * 100));

            return (
              <Card
                key={req.id}
                radius="xl"
                className={cn("transition-opacity", past && "opacity-60")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {/* Route name */}
                    <p className="type-body font-semibold text-ink truncate">
                      {req.route?.name ?? "Route unavailable"}
                    </p>

                    {/* Start → End */}
                    {from && to ? (
                      <p className="type-meta mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-ink-secondary">
                        <span className="truncate">{from}</span>
                        <ArrowRight className="size-3 shrink-0 text-ink-muted" aria-hidden />
                        <span className="truncate">{to}</span>
                      </p>
                    ) : null}

                    {/* Departure date */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <StatusChip tone={past ? "neutral" : "active"}>
                        {dateLabel(req.departure_date)}
                      </StatusChip>
                      <span className="type-micro text-ink-muted">
                        {req.departure_date}
                      </span>
                    </div>
                  </div>

                  {/* Demand badge */}
                  <div className="shrink-0 text-right">
                    <p className="type-numeric text-2xl font-bold text-ink leading-none">
                      {req.count}
                    </p>
                    <p className="type-micro mt-0.5 text-ink-muted">
                      {req.count === 1 ? "seat" : "seats"} wanted
                    </p>
                  </div>
                </div>

                {/* Demand bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="type-micro text-ink-muted">Demand vs. one bus (18 seats)</p>
                    <p className="type-micro font-medium text-ink">{pct}%</p>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-surface-nested"
                    role="progressbar"
                    aria-label={`${req.count} seats requested`}
                    aria-valuenow={req.count}
                    aria-valuemin={0}
                    aria-valuemax={18}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        pct >= 100
                          ? "bg-forest-500 dark:bg-gold-400"
                          : pct >= 50
                            ? "bg-gold-500"
                            : "bg-line-strong",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {pct >= 100 ? (
                    <p className="type-micro mt-1.5 font-medium text-forest-700 dark:text-gold-300">
                      Enough demand for a full bus — schedule a trip?
                    </p>
                  ) : null}
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="type-micro text-ink-muted">
                    Last updated {new Date(req.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                  {!past ? (
                    <ButtonLink
                      size="sm"
                      variant="secondary"
                      icon={BusFront}
                      href={`/admin/free-buses/trips?route=${encodeURIComponent(req.route_id)}&date=${encodeURIComponent(req.departure_date)}`}
                    >
                      Assign buses
                    </ButtonLink>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    className="!text-danger-600 hover:!bg-danger-50 dark:hover:!bg-danger-700/20"
                    onClick={() => setDeleting(req)}
                    aria-label={`Delete ride request for ${req.route?.name ?? req.route_id}`}
                  >
                    Remove
                  </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => { if (!busy) setDeleting(null); }}
        tone="danger"
        title="Remove this ride request?"
        description={
          deleting
            ? `This will remove the demand record for ${deleting.route_id} on ${deleting.departure_date}. The booking records themselves are unaffected.`
            : ""
        }
        confirmLabel="Yes, remove it"
        loading={busy}
        onConfirm={deleteRequest}
      />
    </div>
  );
}
