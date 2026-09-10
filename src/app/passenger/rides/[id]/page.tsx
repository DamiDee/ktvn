import type { Metadata } from "next";
import { RideDetail } from "@/features/passenger/ride-detail";

export const metadata: Metadata = {
  title: "Journey",
  description: "Route, driver, timeline and payment for a single journey.",
};

export default async function RideDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RideDetail rideId={id} />;
}
