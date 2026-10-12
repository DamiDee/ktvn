import type { Metadata } from "next";
import { PassengerRideScreen } from "@/features/paid-rides/passenger/passenger-ride-screen";

export const metadata: Metadata = { title: { absolute: "Paid Rides · K-Rides" } };

export default function PaidRidesHomePage() {
  return <PassengerRideScreen />;
}
