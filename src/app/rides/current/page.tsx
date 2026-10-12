import type { Metadata } from "next";
import { PassengerRideScreen } from "@/features/paid-rides/passenger/passenger-ride-screen";

export const metadata: Metadata = { title: "Current ride" };

/** The live ride lives on the main ride surface; this path is a stable deep link to it. */
export default function CurrentRidePage() {
  return <PassengerRideScreen />;
}
