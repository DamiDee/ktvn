import type { Metadata } from "next";
import { VolunteerRecognition } from "@/features/driver/volunteer-recognition";

export const metadata: Metadata = {
  title: "Recognition",
  description: "Badges and service hours earned through volunteer journeys.",
};

export default function VolunteerRecognitionPage() {
  return <VolunteerRecognition />;
}
