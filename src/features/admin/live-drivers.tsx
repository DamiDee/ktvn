"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Expand, Phone, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusChip } from "@/components/ui/badge";
import { ErrorState, MapUnavailableNotice } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/app-shell";
import { queryKeys } from "@/constants/query-keys";
import { pluralise } from "@/lib/format";
import { adminData, type LiveDriver, type LiveDriverRideStatus } from "./data/admin-data";
import { LiveDriversMap, type LiveDriversMapHandle } from "./live-drivers-map";

/**
 * Where every online driver is right now.
 *
 * Polls `GET /admin/drivers/live` every 8 s (the doc asks for 5–10 s). React
 * Query doesn't run interval refetches while the tab is hidden and refetches
 * on focus, which is the doc's "pause while hidden". A driver who stops
 * pinging drops out of the response after ~15 s, and so off the map.
 */

const LIVE_DRIVERS_POLL_MS = 8_000;

type Filter = "ALL" | "IDLE" | "BUSY";

const RIDE_STATUS_LABEL: Record<LiveDriverRideStatus, string> = {
  DRIVER_ASSIGNED: "Assigned to a ride",
  DRIVER_EN_ROUTE: "Heading to pickup",
  DRIVER_ARRIVING: "Arriving at pickup",
  DRIVER_ARRIVED: "Waiting at pickup",
  IN_PROGRESS: "On a trip",
  PAUSED: "Trip paused",
};

function secondsAgo(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1_000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min ago`;
}

function speed(driver: LiveDriver): string | null {
  if (driver.speedMps === null) return null;
  const kmh = Math.round(driver.speedMps * 3.6);
  return kmh === 0 ? "Stationary" : `${kmh} km/h`;
}

export function LiveDrivers() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const mapRef = useRef<LiveDriversMapHandle>(null);

  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.admin.liveDrivers(),
    queryFn: () => adminData.listLiveDrivers(),
    refetchInterval: LIVE_DRIVERS_POLL_MS,
  });

  const all = data?.items ?? [];
  const busy = all.filter((driver) => driver.currentRide !== null).length;
  const idle = all.length - busy;
  const shown = all.filter((driver) => filter === "ALL" || (filter === "BUSY") === (driver.currentRide !== null));
  const selected = all.find((driver) => driver.driverId === selectedId) ?? null;
  const errorMessage = error instanceof Error ? error.message : undefined;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Control centre"
        title="Driver map"
        description="Every online driver's last known position, refreshed every few seconds."
        action={
          data ? (
            <StatusChip tone="active" dot live size="md">
              {all.length} online · {busy} on a ride
            </StatusChip>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          label="Filter drivers"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "ALL", label: "All", count: all.length },
            { value: "IDLE", label: "Idle", count: idle },
            { value: "BUSY", label: "On a ride", count: busy },
          ]}
        />
        <div className="flex items-center gap-3">
          <Legend />
          <Button variant="secondary" size="sm" icon={Expand} onClick={() => mapRef.current?.fitAll()} disabled={shown.length === 0}>
            Show all
          </Button>
        </div>
      </div>

      {isError && !data ? (
        <ErrorState title="We couldn't load driver locations." description={errorMessage} onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card radius="xl" padded={false} className="relative overflow-hidden">
            <LiveDriversMap
              ref={mapRef}
              drivers={shown}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onError={() => setMapFailed(true)}
              className="h-[60vh] min-h-[360px] w-full"
            />
            <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex flex-col items-center gap-2 px-3">
              {mapFailed ? <MapUnavailableNotice className="pointer-events-auto" /> : null}
              {isError && data ? (
                <p role="status" className="surface-glass rounded-full px-4 py-2 type-meta text-ink-secondary">
                  {errorMessage ?? "Couldn't refresh."} Showing the last positions we had.
                </p>
              ) : null}
              {!isLoading && data && shown.length === 0 ? (
                <p role="status" className="surface-glass rounded-full px-4 py-2 type-meta text-ink-secondary">
                  {all.length === 0 ? "No drivers are online right now." : "No drivers match that filter."}
                </p>
              ) : null}
            </div>
          </Card>

          <div className="space-y-3">
            {selected ? <DriverPanel driver={selected} now={dataUpdatedAt} onClose={() => setSelectedId(null)} /> : null}
            <Card radius="xl" padded={false}>
              <p className="type-micro border-b border-line px-4 py-3 text-ink-muted">
                {isLoading ? "Loading drivers…" : `${shown.length} ${pluralise(shown.length, "driver")}`}
              </p>
              <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto">
                {shown.map((driver) => (
                  <li key={driver.driverId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(driver.driverId)}
                      aria-pressed={driver.driverId === selectedId}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--kx-text)_4%,transparent)]",
                        driver.driverId === selectedId && "bg-[color-mix(in_srgb,var(--kx-text)_6%,transparent)]",
                      )}
                    >
                      <StateDot busy={driver.currentRide !== null} />
                      <span className="min-w-0 flex-1">
                        <span className="type-body block truncate font-medium text-ink">{driver.displayName}</span>
                        <span className="type-meta block truncate text-ink-muted">
                          {driver.currentRide ? RIDE_STATUS_LABEL[driver.currentRide.status] : "Idle"} · {secondsAgo(driver.lastSeenAt, dataUpdatedAt)}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-ink-muted" strokeWidth={2} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      <p className="type-meta mt-5 text-ink-muted">
        Drivers leave the map about 15 seconds after their last location update.
      </p>
    </div>
  );
}

function StateDot({ busy }: { busy: boolean }) {
  return (
    <span
      aria-hidden
      className="size-3 shrink-0 rounded-full border-2 border-white shadow"
      style={{ background: busy ? "var(--kx-gold-500)" : "var(--kx-forest-600)" }}
    />
  );
}

function Legend() {
  return (
    <p className="type-meta hidden items-center gap-3 text-ink-secondary sm:flex">
      <span className="flex items-center gap-1.5"><StateDot busy={false} /> Idle</span>
      <span className="flex items-center gap-1.5"><StateDot busy /> On a ride</span>
    </p>
  );
}

function DriverPanel({ driver, now, onClose }: { driver: LiveDriver; now: number; onClose: () => void }) {
  const moving = speed(driver);
  return (
    <Card radius="xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-card-title truncate text-ink">{driver.displayName}</p>
          <p className="type-meta text-ink-muted">Last seen {secondsAgo(driver.lastSeenAt, now)}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close driver details" className="rounded-full p-1 text-ink-muted hover:text-ink">
          <X className="size-4" strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatusChip tone={driver.currentRide ? "pending" : "active"}>
          {driver.currentRide ? RIDE_STATUS_LABEL[driver.currentRide.status] : "Idle"}
        </StatusChip>
        <StatusChip tone="neutral">
          {driver.availableSeats} {pluralise(driver.availableSeats, "seat")} free
        </StatusChip>
        {moving ? <StatusChip tone="neutral">{moving}</StatusChip> : null}
      </div>

      {driver.phone ? (
        <a href={`tel:${driver.phone.replace(/\s+/g, "")}`} className="type-body mt-3 flex items-center gap-2 text-ink">
          <Phone className="size-4 text-ink-muted" strokeWidth={1.8} aria-hidden />
          <span className="type-numeric">{driver.phone}</span>
        </a>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/admin/drivers/${encodeURIComponent(driver.driverId)}`} className="type-meta font-medium text-gold-800 underline-offset-4 hover:underline dark:text-gold-300">
          Driver record
        </Link>
        {driver.currentRide ? (
          <Link href={`/admin/live-rides/${encodeURIComponent(driver.currentRide.rideId)}`} className="type-meta font-medium text-gold-800 underline-offset-4 hover:underline dark:text-gold-300">
            Current ride
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
