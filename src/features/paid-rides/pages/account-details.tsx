"use client";

import { FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { memberSince } from "@/lib/member-profile";
import type { Viewer } from "../domain/types";
import { driverOnlineEligibility } from "../domain/account-profile";
import { PageSection } from "../components/ride-page";

function Details({ fields }: { fields: Array<[string, string | number | undefined]> }) {
  return <dl className="divide-y divide-[var(--border-subtle)] rounded-[var(--ride-radius-lg)] bg-[var(--surface-primary)] px-4 shadow-[var(--kx-shadow-xs)]">
    {fields.map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-3">
      <dt className="ride-caption">{label}</dt>
      <dd className="ride-body-sm min-w-0 break-words text-right font-medium">{value === undefined || value === "" ? "Not provided" : value}</dd>
    </div>)}
  </dl>;
}

function previewDocument(source: string) {
  if (!source.startsWith("data:")) { window.open(source, "_blank", "noopener,noreferrer"); return; }
  const [header, base64] = source.split(",");
  const mime = header.slice(5).split(";")[0];
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function AccountDetails({ viewer, onRefresh, refreshing }: { viewer: Viewer; onRefresh: () => void; refreshing: boolean }) {
  const account = viewer.account;
  if (!account) return null;
  const driver = account.driver;
  const vehicle = viewer.vehicle;
  const eligibility = driverOnlineEligibility(viewer);
  return <>
    <PageSection title="Personal information">
      <Details fields={[
        ["First name", account.firstName], ["Last name", account.lastName], ["Username", account.username],
        ["Email", account.email], ["Phone", account.phone], ["Address", account.address],
        ["City / area", account.city], ["Country", account.country], ["Member since", memberSince(account.joinedAt)],
        ["Identity verification", account.identityVerified ? "Verified" : "Not yet verified"],
        ...(account.maskedNin ? [["NIN", account.maskedNin] as [string, string]] : []),
      ]} />
    </PageSection>

    {viewer.roles.includes("driver") ? <PageSection title="Driver verification">
      <div role="status" className="mb-3 rounded-[var(--ride-radius-lg)] bg-[var(--surface-primary)] p-4 shadow-[var(--kx-shadow-xs)]">
        <p className="ride-body font-semibold">{driver ? `Application status: ${driver.status}` : "Driver profile unavailable"}</p>
        <p className="ride-body-sm mt-1 text-[var(--text-secondary)]">{eligibility.message ?? "Your driver account and linked vehicle are approved. You can go online from the Drive tab."}</p>
        <Button variant="ghost" size="sm" icon={RefreshCw} loading={refreshing} loadingLabel="Refreshing" className="mt-3" onClick={onRefresh}>Refresh account</Button>
      </div>
      {driver ? <Details fields={[
        ["Driving tracks", driver.track === "Both" ? "Volunteer and professional" : driver.track],
        ["Licence number", driver.licenceNumber], ["Licence class", driver.licenceClass],
        ["Licence expires", memberSince(driver.licenceExpiryDate)], ["Koinonia worker", driver.isKoinoniaWorker ? "Yes" : "No"],
        ...(driver.isKoinoniaWorker ? [["Department", driver.department] as [string, string | undefined]] : [
          ["Guarantor", driver.guarantorName], ["Guarantor phone", driver.guarantorPhone], ["Relationship", driver.guarantorRelationship],
        ] as Array<[string, string | undefined]>),
      ]} /> : null}
    </PageSection> : null}

    {viewer.roles.includes("driver") ? <PageSection title="Your vehicle">
      {vehicle ? <Details fields={[
        ["Make", vehicle.make], ["Model", vehicle.model], ["Colour", vehicle.color],
        ["Plate number", vehicle.plate], ["Year", vehicle.year], ["Passenger seats", vehicle.capacity],
        ["Vehicle approval", vehicle.verified ? "Approved" : "Awaiting approval"],
      ]} /> : <div className="rounded-[var(--ride-radius-lg)] bg-[var(--surface-primary)] p-4">
        <p className="ride-body-sm">{account.vehicleLoadFailed ? "We couldn't load your linked vehicle. Your other account details are available." : "No vehicle details are linked to this account yet."}</p>
        <Button size="sm" variant="ghost" className="mt-2" onClick={onRefresh} loading={refreshing}>Refresh account</Button>
      </div>}
    </PageSection> : null}

    {account.documents.length ? <PageSection title="Your documents">
      <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--ride-radius-lg)] bg-[var(--surface-primary)] shadow-[var(--kx-shadow-xs)]">
        {account.documents.map((document) => <div key={document.label} className="flex items-center gap-3 p-4">
          <FileText className="size-5 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
          <div className="min-w-0 flex-1"><p className="ride-body-sm font-medium">{document.label}</p><p className="ride-caption">{document.provided ? "Submitted" : "Not provided"}</p></div>
          {document.source ? <Button size="sm" variant="ghost" aria-label={`View ${document.label}`} onClick={() => previewDocument(document.source!)}>View</Button> : null}
        </div>)}
      </div>
    </PageSection> : null}
  </>;
}
