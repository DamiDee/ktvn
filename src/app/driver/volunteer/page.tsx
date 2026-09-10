import type { Metadata } from "next";
import { VolunteerRecognition } from "@/features/driver/volunteer-recognition";

export const metadata: Metadata = {
  title: "Service",
  description: "Your volunteer service record and recognition.",
};

export default function VolunteerServicePage() {
  return <VolunteerRecognition />;
}
