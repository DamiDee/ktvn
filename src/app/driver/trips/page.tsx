import type { Metadata } from "next";
import { DriverTrips } from "@/features/driver/driver-trips";

export const metadata: Metadata = {
  title: "Trips",
  description: "Your active, completed and cancelled journeys.",
};

export default function DriverTripsPage() {
  return <DriverTrips />;
}
