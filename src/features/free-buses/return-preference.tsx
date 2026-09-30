"use client";
import { useState } from "react";
import { Checkbox } from "@/components/ui/input";
import { readReturnPreference, saveReturnPreference } from "@/lib/return-preference";

export function ReturnPreference({ userId, bookingId }: { userId: string; bookingId: string }) {
  const [requested, setRequested] = useState(() => readReturnPreference(userId, bookingId));
  const [error, setError] = useState("");
  return <section className="order-2 mt-6 rounded-2xl border border-gold-500/25 bg-gold-500/5 p-4 print:hidden">
    <p className="mb-3 text-xs font-medium text-gold-800 dark:text-gold-300">ROUND-TRIP PREFERENCE · PREVIEW</p>
    <Checkbox label="I’d like to return on this same bus" checked={requested} onChange={(e) => { if (saveReturnPreference(userId, bookingId, e.target.checked)) { setRequested(e.target.checked); setError(""); } else setError("Your browser could not save this preference."); }} />
    {requested ? <p role="status" className="mt-2 text-xs font-medium text-gold-800 dark:text-gold-300">Preference saved on this device.</p> : null}
    <p className="mt-2 text-xs leading-relaxed text-ink-secondary">Saved only on this device. Not sent to the transport team yet. This does not reserve a return seat or guarantee the same bus; book a separate journey home for now.</p>
    {error ? <p role="alert" className="mt-2 text-sm text-danger-600">{error}</p> : null}
  </section>;
}
