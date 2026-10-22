"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Ride } from "../domain/types";

export function DriverPaymentDetails({ ride }: { ride: Ride }) {
  const [notice, setNotice] = useState("");
  if (ride.status !== "COMPLETED") return null;
  const bank = ride.driver?.bankAccount;
  return <section aria-label="Driver payment details" className="rounded-[var(--ride-radius-lg)] border border-[var(--border-subtle)] p-4">
    <h3 className="ride-body font-semibold">Driver’s bank account</h3>
    {bank ? <>
      <p className="ride-body-sm mt-2">{bank.bankName}</p>
      {bank.accountName ? <p className="ride-body-sm">{bank.accountName}</p> : null}
      <p className="ride-num mt-1 text-xl tracking-wider">{bank.accountNumber}</p>
      <p className="ride-caption mt-2">Confirm the recipient’s name in your banking app before paying. A transfer here does not automatically mark the ride as paid.</p>
      <Button size="sm" variant="ghost" className="mt-2" onClick={async () => {
        try { await navigator.clipboard.writeText(bank.accountNumber); setNotice("Account number copied."); }
        catch { setNotice("Select the account number above to copy it."); }
      }}>Copy account number</Button>
      <p role="status" className="ride-caption">{notice}</p>
    </> : <p className="ride-body-sm mt-2 text-[var(--text-secondary)]">Bank details haven’t been provided for this ride. Ask your driver for payment details.</p>}
  </section>;
}
