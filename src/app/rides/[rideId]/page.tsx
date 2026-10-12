import type { Metadata } from "next";
import { RideDetail } from "@/features/paid-rides/history/ride-history";

export const metadata: Metadata = { title: "Trip details" };

export default async function RideDetailPage({ params }: PageProps<"/rides/[rideId]">) {
  const { rideId } = await params;
  return <RideDetail role="passenger" rideId={decodeURIComponent(rideId)} />;
}
