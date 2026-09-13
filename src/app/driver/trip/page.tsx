import type { Metadata } from "next";
import { DriverTrip } from "@/features/driver/driver-trip";

export const metadata: Metadata = {
  title: "Your journey",
  description: "Live route, passengers and safety controls.",
};

export default function DriverTripPage() {
  return <DriverTrip />;
}
