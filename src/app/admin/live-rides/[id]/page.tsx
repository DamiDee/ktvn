import type { Metadata } from "next";
import { LiveRideDetail } from "@/features/admin/live-ride-detail";

export const metadata: Metadata = {
  title: "Live journey",
  description: "Live position, journey detail and safety response.",
};

export default async function LiveRideDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LiveRideDetail rideId={id} />;
}
