"use client";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { ApiUser } from "@/types/freebus-api";

/** A review workflow preview, not a live disciplinary record or automatic sanction. */
export function PassengerStrikes({ user }: { user: ApiUser }) {
  const [open, setOpen] = useState(false);
  return <><Button size="sm" variant="ghost" icon={ShieldAlert} onClick={() => setOpen(true)} aria-label={`Strikes preview for ${user.first_name} ${user.last_name}`}>Strikes</Button><Modal open={open} onClose={() => setOpen(false)} title="Passenger strikes · preview" description={`${user.first_name} ${user.last_name}`}>
    <p className="text-sm leading-relaxed text-ink-secondary">Strike records are not connected yet. Nothing entered here can affect an account, booking or travel eligibility. No strike count is available.</p>
    <fieldset disabled className="mt-5 space-y-4"><Select label="Reason for review" options={[{ value: "", label: "Choose a reason" }, { value: "no-show", label: "Missed confirmed pickup" }, { value: "conduct", label: "Conduct concern" }, { value: "other", label: "Other" }]} /><Input label="Related booking reference" placeholder="Optional booking reference" /><Textarea label="Incident details" placeholder="Factual details for an authorised reviewer" /><Button disabled block>Submit for review — not connected</Button></fieldset>
    <p className="mt-4 text-xs leading-relaxed text-ink-secondary">Before activation: backend records, role permissions, audit trail, passenger notice and a review/appeal process are needed. No automatic deactivation is enabled.</p>
  </Modal></>;
}
