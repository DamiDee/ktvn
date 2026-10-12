import type { Metadata } from "next";
import { DriverRideScreen } from "@/features/paid-rides/driver/driver-ride-screen";

export const metadata: Metadata = { title: "Drive" };

export default function DriverRidesHomePage() {
  return <DriverRideScreen />;
}
