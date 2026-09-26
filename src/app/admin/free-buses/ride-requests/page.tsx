import type { Metadata } from "next";
import { AdminRideRequests } from "@/features/free-buses/admin-ride-requests";

export const metadata: Metadata = {
  title: "Ride Requests",
  description: "View aggregated seat demand per route and date.",
};

export default function RideRequestsAdminPage() {
  return <AdminRideRequests />;
}
