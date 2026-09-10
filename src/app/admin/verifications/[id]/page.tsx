import type { Metadata } from "next";
import { VerificationReview } from "@/features/admin/verification-review";

export const metadata: Metadata = {
  title: "Application review",
  description: "Identity, licence, vehicle, documents and inspection.",
};

export default async function VerificationReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VerificationReview id={id} />;
}
