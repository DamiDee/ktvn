import type { Metadata } from "next";
import { RideDetail } from "@/features/paid-rides/history/ride-history";

export const metadata: Metadata = { title: "Trip details" };

export default async function DriverTripDetailPage({ params }: PageProps<"/rides/driver/trips/[rideId]">) {
  const { rideId } = await params;
  return <RideDetail role="driver" rideId={decodeURIComponent(rideId)} />;
}
