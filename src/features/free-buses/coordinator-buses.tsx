"use client";
import { PageHeader } from "@/components/layout/app-shell";
import { RecordsTable } from "@/components/ui/records-table";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { useLiveQuery } from "./live-queries";
import { watParts } from "@/lib/trips";
import type { ApiBus, ApiRoute, ApiTrip } from "@/types/freebus-api";

export function CoordinatorBuses() {
  const buses = useLiveQuery<ApiBus[]>("buses");
  const trips = useLiveQuery<ApiTrip[]>("trips");
  const routes = useLiveQuery<ApiRoute[]>("routes");
  const assigned = (b: ApiBus) => {
    const trip = b.current_trip_id ? trips.data?.find((t) => t.id === b.current_trip_id) : trips.data?.find((t) => t.bus_id === b.id && t.status !== "Completed" && t.status !== "Cancelled");
    if (!trip) return "No trip assigned";
    const when = watParts(trip.departure_time);
    return `${routes.data?.find((r) => r.id === trip.route_id)?.name ?? "Route unavailable"} · ${when.date} ${when.time.slice(0, 5)}`;
  };
  return <><PageHeader eyebrow="Free Buses · Route Coordinator" title="Buses" description="Choose a bus to check bookings and board members." />{buses.error ? <ErrorState title="Buses unavailable" description={buses.error.message} onRetry={() => void buses.refetch()} /> : buses.isPending ? <p role="status">Loading boarding fleet…</p> : <RecordsTable caption="Boarding fleet" rows={buses.data ?? []} rowKey={(b) => b.id} searchIn={(b) => `${b.license_plate} ${assigned(b)}`} columns={[
    { id: "plate", header: "Bus", primary: true, cell: (b) => <span className="font-semibold text-ink">{b.license_plate}</span> },
    { id: "trip", header: "Assigned trip", secondary: true, cell: (b) => <span className="text-ink-secondary">{assigned(b)}</span> },
    { id: "seats", header: "Seats", meta: true, cell: (b) => `${b.current_passenger_count} / ${b.capacity}` },
    { id: "state", header: "State", meta: true, cell: (b) => b.state },
    { id: "actions", header: "Boarding", actions: true, align: "end", cell: (b) => <ButtonLink size="sm" href={`/admin/free-buses/boarding?bus=${b.id}`}>Open bookings</ButtonLink> },
  ]} />}</>;
}
