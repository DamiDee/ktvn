"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BusFront, RefreshCw } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { StatusChip } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/app-shell";
import { useLiveUser } from "@/features/free-buses/live-shell";
import { memberProfileDetails, memberSince } from "@/lib/member-profile";

/** Uses the authenticated API profile supplied by the shell, never the demo passenger. */
export function LiveMemberProfile() {
  const user = useLiveUser();
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Member";

  return <div className="mx-auto max-w-3xl">
    <PageHeader eyebrow="Your account" title="Profile" description="Your personal details, from your K-Rides account." action={
      <Button variant="ghost" icon={RefreshCw} loading={refreshing} loadingLabel="Refreshing" onClick={async () => {
        setRefreshing(true);
        try { await client.invalidateQueries({ queryKey: ["freebus-live", "session"] }); }
        finally { setRefreshing(false); }
      }}>Refresh profile</Button>
    } />

    <Card radius="xl" className="mb-5">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Avatar name={name} size="xl" />
        <div className="min-w-0 flex-1">
          <h2 className="type-section-title break-words text-ink">{name}</h2>
          <p className="type-body mt-1 break-all text-ink-secondary">{user.email || "Email not provided"}</p>
          <div className="mt-3 flex flex-wrap gap-2"><StatusChip tone="neutral">Member</StatusChip><StatusChip tone={user.is_active ? "active" : "neutral"}>{user.is_active ? "Account active" : "Account inactive"}</StatusChip></div>
          <p className="type-meta mt-3 text-ink-muted">Member since {memberSince(user.created_at)}</p>
        </div>
      </div>
    </Card>

    <Card radius="xl" className="mb-5">
      <h2 className="type-card-title text-ink">Personal details</h2>
      <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">{memberProfileDetails(user).map(({ label, value }) => <div key={label} className={label === "Address" ? "min-w-0 sm:col-span-2" : "min-w-0"}>
        <dt className="type-meta text-ink-muted">{label}</dt>
        <dd className="type-body mt-1 break-words text-ink [overflow-wrap:anywhere]">{value}</dd>
      </div>)}</dl>
      <div className="mt-6 border-t border-line pt-5"><p className="type-meta text-ink-muted">Identity verification</p><p className="type-body mt-1 text-ink">{user.is_identity_verified ? "Verified" : "Not verified"}</p><p className="type-meta mt-2 text-ink-muted">This status comes from your account record. No NIN is required on this page.</p></div>
      <p className="type-meta mt-5 text-ink-muted">Profile editing is not connected yet. These details are read-only.</p>
    </Card>

    <Card radius="xl" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="type-card-title text-ink">Ready for your next service?</h2><p className="type-meta mt-1 text-ink-secondary">Find a pickup point, reserve a free seat, or view your boarding passes.</p></div>
      <ButtonLink href="/passenger/free-buses" icon={BusFront} className="shrink-0">Open Free Buses</ButtonLink>
    </Card>
  </div>;
}
