"use client";

import { useState, type ReactNode } from "react";
import type { ApiUser } from "@/types/freebus-api";
import { Button } from "@/components/ui/button";
import { displayPhone } from "@/lib/account-display";
import { accountDocumentSource } from "@/features/paid-rides/domain/account-profile";
import { accountDate, accountRoleLabel, contactPhoneHref } from "./account-directory";

export function ContactPhone({ value }: { value?: string | null }) {
  const href = contactPhoneHref(value);
  return href ? <a className="underline underline-offset-4" href={href}>{displayPhone(value)}</a> : <>{displayPhone(value)}</>;
}
function Fields({ values }: { values: [string, ReactNode][] }) {
  return <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">{values.map(([label, value]) => <div className="min-w-0" key={label}><dt className="text-xs font-medium text-ink-muted">{label}</dt><dd className="mt-1 break-words text-sm text-ink">{value || "Not provided"}</dd></div>)}</dl>;
}

export function AccountDetails({ user, paid = true }: { user: ApiUser; paid?: boolean }) {
  const [preview, setPreview] = useState<{ label: string; source: string } | null>(null);
  const profile = user.driver_profile;
  const documents = profile ? [
    { label: "Profile photo", value: profile.profile_photo },
    { label: "Licence document", value: profile.licence_photo },
    { label: "NIN slip", value: profile.nin_slip },
    { label: "Guarantor photo", value: profile.guarantor_photo },
  ] : [];
  return <div className="space-y-6">
    <section aria-label="Personal and contact information">
      <h3 className="mb-4 text-sm font-semibold text-ink">Personal & contact information</h3>
      <Fields values={[
        ["First name", user.first_name], ["Last name", user.last_name], ["Username", user.username],
        ["Email", user.email ? <a href={`mailto:${user.email}`} className="underline underline-offset-4">{user.email}</a> : null], ["Phone", <ContactPhone key="phone" value={user.phone} />],
        ["Address", user.address], ["City / area", user.city], ["Country", user.country], ["Role", accountRoleLabel(user.role, paid)],
        ["Account status", user.is_active ? "Active" : "Deactivated"], ["Identity verification", user.is_identity_verified ? "Verified" : "Not verified"],
        ["Identity type", user.identity_type], ["Identity number", user.identity_number],
        ["Registered", accountDate(user.created_at)], ["Last updated", accountDate(user.updated_at)], ["Last seen", accountDate(user.last_seen)], ["Account ID", user.id],
      ]} />
    </section>
    {profile ? <section aria-label="Driver profile" className="border-t border-line pt-5">
      <h3 className="mb-4 text-sm font-semibold text-ink">Driver information</h3>
      <Fields values={[
        ["Driving track", profile.track], ["Application status", profile.status], ["Licence number", profile.licence_number], ["Licence class", profile.licence_class], ["Licence expiry", accountDate(profile.licence_expiry_date)],
        ["Koinonia worker", profile.is_koinonia_worker ? "Yes" : "No"], ["Department", profile.koinonia_department], ["Guarantor", profile.guarantor_name], ["Guarantor phone", <ContactPhone key="guarantor" value={profile.guarantor_phone} />], ["Relationship", profile.guarantor_relationship],
        ["Driver profile ID", profile.id], ["Vehicle ID", profile.car_id || user.car], ["Profile created", accountDate(profile.created_at)], ["Profile updated", accountDate(profile.updated_at)],
      ]} />
      <h4 className="mt-5 mb-2 text-xs font-semibold text-ink-secondary">Submitted photos & documents</h4>
      <ul className="space-y-2">{documents.map(({ label, value }) => {
        const source = accountDocumentSource(value);
        return <li key={label} className="flex items-center justify-between gap-3 rounded-xl bg-surface-nested px-3 py-2"><span className="text-sm text-ink">{label}</span>{source ? <Button variant="ghost" size="sm" onClick={() => setPreview({ label, source })}>View {label.toLowerCase()}</Button> : <span className="text-xs text-ink-muted">{value ? "Preview unavailable" : "Not provided"}</span>}</li>;
      })}</ul>
    </section> : user.role === "Driver" ? <p className="text-sm text-ink-secondary">No driver profile was returned for this account.</p> : null}
    {preview ? <section aria-label={`${preview.label} preview`} className="space-y-3 rounded-xl border border-line p-3">
      <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold text-ink">{preview.label}</h4><Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Close preview</Button></div>
      {/(?:^data:application\/pdf|\.pdf(?:\?|$))/i.test(preview.source) ? <iframe src={preview.source} title={preview.label} className="h-[60vh] w-full rounded-xl border border-line" referrerPolicy="no-referrer" /> :
        // Documents may be Base64 or protected API URLs, which Next Image cannot optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview.source} alt={preview.label} className="max-h-[65vh] w-full rounded-xl object-contain" referrerPolicy="no-referrer" />}
    </section> : null}
  </div>;
}
