"use client";
import { PageHeader } from "@/components/layout/app-shell";
import { RecordsTable } from "@/components/ui/records-table";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { useLiveQuery } from "./live-queries";
import type { ApiBus } from "@/types/freebus-api";

export function CoordinatorBuses() {
  const buses = useLiveQuery<ApiBus[]>("buses");
  return <><PageHeader eyebrow="Free Buses · Route Coordinator" title="Buses" description="Choose a bus to check bookings and board members." />{buses.error ? <ErrorState title="Buses unavailable" description={buses.error.message} onRetry={() => void buses.refetch()} /> : buses.isPending ? <p role="status">Loading boarding fleet…</p> : <RecordsTable caption="Boarding fleet" rows={buses.data ?? []} rowKey={(b) => b.id} searchIn={(b) => b.license_plate} columns={[
    { id: "plate", header: "Bus", primary: true, cell: (b) => <span className="font-semibold text-ink">{b.license_plate}</span> },
    { id: "seats", header: "Seats", meta: true, cell: (b) => `${b.current_passenger_count} / ${b.capacity}` },
    { id: "state", header: "State", meta: true, cell: (b) => b.state },
    { id: "actions", header: "Boarding", actions: true, align: "end", cell: (b) => <ButtonLink size="sm" href={`/admin/free-buses/boarding?bus=${b.id}`}>Open bookings</ButtonLink> },
  ]} />}</>;
}
