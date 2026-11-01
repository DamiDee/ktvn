"use client";
import { useQuery } from "@tanstack/react-query";
import { freebusRequest, FreebusError } from "@/services/freebus-api";
import { Button } from "@/components/ui/button";
import { contactPhoneHref } from "@/features/admin/accounts/account-directory";
import type { ApiUser } from "@/types/freebus-api";

export default function BookingContact({ userId, viewerId, label }: { userId: string; viewerId: string; label: string }) {
  const contact = useQuery({
    queryKey: ["paid-rides", "schedule-contact", viewerId, userId],
    queryFn: async ({ signal }) => {
      const user = await freebusRequest<ApiUser>(`users/${encodeURIComponent(userId)}`, { signal });
      if (user.id !== userId) throw new Error("The contact could not be confirmed.");
      // Keep only the contact fields, never identity documents or personal profile data.
      return { name: [user.first_name, user.last_name].filter(Boolean).join(" ").trim(), phone: user.phone };
    },
    staleTime: 60_000, retry: false,
  });
  const href = contactPhoneHref(contact.data?.phone);
  return <div className="rounded-[var(--kx-radius-md)] bg-surface-nested p-3">
    <p className="ride-caption">{label}</p>
    {contact.isPending ? <p role="status">Loading contact…</p> : contact.isError ? <div role="status"><p className="ride-body-sm">{contact.error instanceof FreebusError && contact.error.status === 403 ? "Contact access is unavailable for this account. Please contact support." : "Contact details could not load."}</p><Button size="sm" variant="ghost" onClick={() => void contact.refetch()}>Retry contact</Button></div> : <>
      <p className="ride-body-sm mt-1 font-semibold">{contact.data.name || "Name not provided"}</p>
      {href ? <a className="mt-2 inline-block text-sm underline underline-offset-4" href={href}>Call {contact.data.phone}</a> : <p className="ride-caption mt-1">Phone not provided</p>}
    </>}
  </div>;
}
