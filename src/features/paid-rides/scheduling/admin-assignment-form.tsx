"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminData } from "@/features/admin/data/admin-data";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DriverAccountStatus, VerificationStatus } from "@/types/enums";
import { uuid } from "./contract";
import { scheduleError } from "./booking-card";

export default function AdminAssignmentForm({ busy, stale, onAssign, onClose }: {
  busy: boolean; stale: boolean; onAssign: (driverId: string) => Promise<void>; onClose: () => void;
}) {
  const [search, setSearch] = useState(""), [driverId, setDriverId] = useState(""), [manual, setManual] = useState(false), [error, setError] = useState("");
  const query = useDebouncedValue(search.trim());
  const drivers = useQuery({ queryKey: ["paid-rides", "admin", "assignment-drivers", query], queryFn: () => adminData.listDrivers({ filter: "ALL", q: query }), enabled: !manual, staleTime: 30_000 });
  const eligible = drivers.data?.items.filter((d) => d.verificationStatus === VerificationStatus.APPROVED && d.accountStatus !== DriverAccountStatus.DEACTIVATED && d.vehicle.verified) ?? [];
  return <form className="mt-4 space-y-3 border-t border-line pt-4" onSubmit={async (event) => {
    event.preventDefault(); if (busy || stale) return; setError("");
    try { await onAssign(uuid.parse(driverId.trim())); onClose(); } catch (e) { setError(scheduleError(e)); }
  }}>
    {manual ? <Input label="Driver ID" value={driverId} required disabled={busy} onChange={(e) => setDriverId(e.target.value)} hint="Enter the driver’s account UUID." /> : <>
      <Input label="Search drivers" value={search} disabled={busy} onChange={(e) => { setSearch(e.target.value); setDriverId(""); }} placeholder="Name or vehicle registration" />
      {drivers.isPending ? <p role="status" className="ride-caption">Loading drivers…</p> : drivers.isError ? <div role="alert"><p className="ride-caption">We couldn’t load drivers.</p><Button type="button" size="sm" variant="ghost" onClick={() => void drivers.refetch()}>Try again</Button></div> : <Select label="Driver" value={driverId} required disabled={busy || drivers.isFetching} onChange={(e) => setDriverId(e.target.value)} options={[{ value: "", label: "Choose a driver" }, ...eligible.map((d) => ({ value: d.id, label: `${d.fullName} · ${d.vehicle.plateNumber}` }))]} />}
      {!drivers.isPending && !drivers.isError && !eligible.length ? <p className="ride-caption">No approved drivers match this search.</p> : null}
    </>}
    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setManual(!manual); setDriverId(""); setError(""); }}>{manual ? "Search the driver list" : "Enter a driver ID instead"}</Button>
    <p className="ride-caption">Driver eligibility and overlapping trips are checked when you assign.</p>
    {stale ? <p role="alert" className="ride-body-sm">This booking changed. Close this form and review its latest details before assigning.</p> : null}
    {error ? <p role="alert" className="ride-body-sm">{error}</p> : null}
    <div className="flex flex-wrap gap-2"><Button pill size="sm" type="submit" loading={busy} loadingLabel="Assigning driver" disabled={stale || !uuid.safeParse(driverId.trim()).success || !manual && (drivers.isFetching || !eligible.some((d) => d.id === driverId))}>Confirm assignment</Button><Button pill size="sm" type="button" variant="ghost" disabled={busy} onClick={onClose}>Close</Button></div>
  </form>;
}
