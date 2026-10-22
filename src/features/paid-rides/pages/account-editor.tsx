"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getRideService } from "../services";
import { ERROR_COPY, toRideError } from "../domain/errors";
import type { AccountUpdate, RideAccountProfile } from "../domain/types";

export function AccountEditor({ account }: { account: RideAccountProfile }) {
  const queries = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const initial = (): AccountUpdate => ({ first_name: account.firstName, last_name: account.lastName, phone: account.phone, address: account.address, city: account.city ?? "", country: account.country });
  const [form, setForm] = useState(initial);
  const fields: Array<[keyof AccountUpdate, string]> = [["first_name", "First name"], ["last_name", "Last name"], ["phone", "Phone number"], ["address", "Address"], ["city", "City / area"], ["country", "Country"]];
  return <div className="mt-3 rounded-[var(--ride-radius-lg)] bg-[var(--surface-primary)] p-4">
    {editing ? <form onSubmit={async (event) => {
      event.preventDefault();
      if (saving) return;
      setSaving(true); setNotice("");
      try {
        await getRideService().updateAccount(form);
        await queries.invalidateQueries({ queryKey: ["paid-rides", "viewer"] });
        setEditing(false); setNotice("Your profile has been updated.");
      } catch (error) { setNotice(ERROR_COPY[toRideError(error).code].body); }
      finally { setSaving(false); }
    }}>
      <fieldset disabled={saving} className="grid gap-3 sm:grid-cols-2">
        {fields.map(([key, label]) => <label key={key} className="ride-body-sm flex flex-col gap-1">
          {label}<input name={key} type={key === "phone" ? "tel" : "text"} required={key !== "city"} maxLength={250} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] px-3 py-3 text-[var(--text-primary)]" />
        </label>)}
      </fieldset>
      <div className="mt-4 flex gap-2"><Button type="submit" loading={saving} loadingLabel="Saving">Save changes</Button><Button type="button" variant="ghost" disabled={saving} onClick={() => { setEditing(false); setNotice(""); }}>Cancel</Button></div>
    </form> : <Button size="sm" onClick={() => { setForm(initial()); setNotice(""); setEditing(true); }}>Edit personal details</Button>}
    {notice ? <p role="status" className="ride-body-sm mt-3">{notice}</p> : null}
    <p className="ride-caption mt-3">For changes to verified licence, vehicle or identity documents, contact the transport team for review.</p>
  </div>;
}
