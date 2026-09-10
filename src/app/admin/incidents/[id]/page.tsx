import type { Metadata } from "next";
import { IncidentDetail } from "@/features/admin/incident-detail";

export const metadata: Metadata = {
  title: "Incident",
  description: "What happened, who was involved and what was done.",
};

export default async function AdminIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IncidentDetail incidentId={id} />;
}
