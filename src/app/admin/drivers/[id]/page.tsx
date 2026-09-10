import type { Metadata } from "next";
import { DriverDetail } from "@/features/admin/driver-detail";

export const metadata: Metadata = {
  title: "Driver record",
  description: "Verification, vehicle, activity and oversight actions.",
};

export default async function AdminDriverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DriverDetail driverId={id} />;
}
