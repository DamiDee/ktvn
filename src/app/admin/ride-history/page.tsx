import type { Metadata } from "next";
import { AdminRideHistory } from "@/features/admin/ride-history";
export const metadata: Metadata = { title: "Ride history" };
export default function RideHistoryPage() { return <AdminRideHistory />; }
