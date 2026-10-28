"use client";

import { useQuery } from "@tanstack/react-query";
import type { Driver } from "@/types/models";
import type { ApiUser } from "@/types/freebus-api";
import { freebusRequest } from "@/services/freebus-api";
import { LIVE_FREE_BUSES } from "@/lib/freebus-config";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountDetails, ContactPhone } from "./account-details";

export function DriverContactCard({ driver }: { driver: Driver }) {
  const account = useQuery({
    queryKey: ["admin", "account-details", driver.id],
    queryFn: async ({ signal }) => {
      const result = await freebusRequest<ApiUser>(`users/${encodeURIComponent(driver.id)}`, { signal });
      if (!result || result.id !== driver.id) throw new Error("The driver account could not be confirmed.");
      return result;
    },
    enabled: LIVE_FREE_BUSES, retry: false,
  });
  return <Card radius="xl">
    <CardHeader title="Contact & personal details" description="Account information and the details submitted during registration." />
    <div className="mt-5">
      {account.data ? <AccountDetails user={account.data} /> : <>
        <dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-ink-muted">Email</dt><dd className="mt-1 break-all text-sm text-ink">{driver.email ? <a href={`mailto:${driver.email}`} className="underline underline-offset-4">{driver.email}</a> : "Not provided"}</dd></div><div><dt className="text-xs text-ink-muted">Phone</dt><dd className="mt-1 text-sm text-ink"><ContactPhone value={driver.phone} /></dd></div></dl>
        {account.isFetching ? <p role="status" className="mt-4 text-sm text-ink-muted">Loading the full account profile…</p> : account.isError ? <div role="alert" className="mt-4 space-y-2"><p className="text-sm text-ink-secondary">The full account profile could not load. The contact information above comes from the driver record.</p><Button size="sm" variant="secondary" onClick={() => void account.refetch()}>Retry profile</Button></div> : null}
      </>}
    </div>
  </Card>;
}
