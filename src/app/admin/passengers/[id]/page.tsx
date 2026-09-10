import type { Metadata } from "next";
import { PassengerDetail } from "@/features/admin/passenger-detail";

export const metadata: Metadata = {
  title: "Member record",
  description: "Membership, safety setup and recent journeys.",
};

export default async function AdminPassengerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PassengerDetail passengerId={id} />;
}
