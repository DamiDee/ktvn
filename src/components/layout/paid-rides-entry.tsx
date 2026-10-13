"use client";

import { redirect } from "next/navigation";
import { CarFront } from "lucide-react";
import { PAID_RIDES_ENABLED } from "@/features/paid-rides/config";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";

/** Old ride URLs no longer expose the retired service-track interface. */
export function PaidRidesEntry({ href }: { href: string }) {
  if (PAID_RIDES_ENABLED) redirect(href);
  return <main id="main" className="mx-auto max-w-xl px-5 py-20"><EmptyState icon={CarFront} title="Paid rides are coming to this workspace" description="This deployment hasn’t enabled paid rides yet. You can still sign in or explore the driver application." action={<ButtonLink href="/login">Back to sign in</ButtonLink>} /></main>;
}
