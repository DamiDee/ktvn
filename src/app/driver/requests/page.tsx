import type { Metadata } from "next";
import { DriverRequests } from "@/features/driver/driver-requests";

export const metadata: Metadata = {
  title: "Requests",
  description: "Ride requests from members heading your direction.",
};

export default function DriverRequestsPage() {
  return <DriverRequests />;
}
