import type { Metadata } from "next";
import { IncidentsList } from "@/features/admin/incidents-list";

export const metadata: Metadata = {
  title: "Incidents",
  description: "Everything raised by a member, a driver or an SOS activation.",
};

export default function AdminIncidentsPage() {
  return <IncidentsList />;
}
