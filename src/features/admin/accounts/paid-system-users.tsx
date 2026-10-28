"use client";
import { AdminUsers } from "@/features/free-buses/admin-users";
import { LIVE_FREE_BUSES } from "@/lib/freebus-config";
import { EmptyState } from "@/components/ui/states";
import { Users } from "lucide-react";
export function PaidSystemUsers() {
  if (!LIVE_FREE_BUSES) return <EmptyState icon={Users} title="System Users needs a live connection" description="Connect the account service to view and manage real platform accounts." />;
  return <AdminUsers workspace="paid-rides" />;
}
