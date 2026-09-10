import type { Metadata } from "next";
import { AdminDashboard } from "@/features/admin/admin-dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Network overview, live rides and anything needing attention.",
};

export default function AdminHomePage() {
  return <AdminDashboard />;
}
