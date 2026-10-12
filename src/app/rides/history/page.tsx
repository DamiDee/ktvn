import type { Metadata } from "next";
import { RideHistory } from "@/features/paid-rides/history/ride-history";

export const metadata: Metadata = { title: "Activity" };

export default function RideHistoryPage() {
  return <RideHistory role="passenger" />;
}
