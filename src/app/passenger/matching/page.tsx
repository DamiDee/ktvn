import type { Metadata } from "next";
import { MatchingScreen } from "@/features/passenger/matching-screen";

export const metadata: Metadata = {
  title: "Finding a driver",
  description: "Matching you with a verified driver heading your way.",
};

export default function MatchingPage() {
  return <MatchingScreen />;
}
