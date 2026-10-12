import type { Metadata } from "next";
import { RideHistory } from "@/features/paid-rides/history/ride-history";

export const metadata: Metadata = { title: "Trips" };

export default function DriverTripsPage() {
  return <RideHistory role="driver" />;
}
